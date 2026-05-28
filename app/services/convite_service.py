import asyncio
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import SessionLocal
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest, BulkConviteResponse, ConviteResumoEnvio, ConviteResultadoItem
from app.services import audit_log_service, email_dispatch_service, email_service, empresa_quota_service

logger = logging.getLogger(__name__)


_TOKEN_BYTES = 48
_EXPIRACAO_HORAS = 72


@dataclass(frozen=True)
class ConviteEmailPendente:
    email: str
    token: str


def _gerar_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def _expiracao_padrao() -> datetime:
    return datetime.now(UTC) + timedelta(hours=_EXPIRACAO_HORAS)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def convite_esta_pendente(convite: Convite, *, agora: datetime | None = None) -> bool:
    if convite.usado_em is not None:
        return False
    momento = agora or datetime.now(UTC)
    return _as_utc(convite.expiracao) > momento


def _renovar_convite(convite: Convite, criado_por: int) -> str:
    token = _gerar_token()
    convite.token = token
    convite.expiracao = _expiracao_padrao()
    convite.usado_em = None
    convite.criado_por = criado_por
    return token


def renovar_convite_expirado(
    db: Session,
    convite: Convite,
    criado_por: int,
    *,
    empresa_id: int,
    ip: str | None = None,
) -> str:
    """Renova token e expiração de convite expirado (não usado)."""
    token = _renovar_convite(convite, criado_por)
    audit_log_service.log(
        db,
        acao="convite.renovado",
        usuario_id=criado_por,
        empresa_id=empresa_id,
        alvo=convite.email,
        ip=ip,
    )
    db.commit()
    return token


def _get_convite_ativo(db: Session, token: str, *, for_update: bool = False) -> Convite | None:
    stmt = select(Convite).where(Convite.token == token)
    if for_update:
        stmt = stmt.with_for_update()
    convite = db.scalar(stmt)
    if convite is None or not convite_esta_pendente(convite):
        return None
    return convite


def _prefetch_usuarios_por_email(db: Session, empresa_id: int, emails: list[str]) -> dict[str, Usuario]:
    if not emails:
        return {}
    rows = db.scalars(
        select(Usuario).where(
            and_(
                Usuario.empresa_id == empresa_id,
                Usuario.email.in_(emails),
            )
        )
    ).all()
    return {u.email: u for u in rows}


def _prefetch_convites_por_email(db: Session, empresa_id: int, emails: list[str]) -> dict[str, Convite]:
    if not emails:
        return {}
    rows = db.scalars(
        select(Convite).where(
            and_(
                Convite.empresa_id == empresa_id,
                Convite.email.in_(emails),
            )
        )
    ).all()
    return {c.email: c for c in rows}


def criar_bulk_convites(
    db: Session,
    empresa_id: int,
    data: BulkConviteRequest,
    criado_por: int,
    ip: str | None = None,
) -> tuple[BulkConviteResponse, list[ConviteEmailPendente]]:
    resultados: list[ConviteResultadoItem] = []
    emails_bloqueados_limite: list[str] = []
    bloqueados_limite = 0
    reservas_lote = 0
    emails_pendentes: list[ConviteEmailPendente] = []

    empresa = db.get(Empresa, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")
    empresa_nome = empresa.nome

    emails_norm = [str(e).strip().lower() for e in data.emails]
    usuarios_map = _prefetch_usuarios_por_email(db, empresa_id, emails_norm)
    convites_map = _prefetch_convites_por_email(db, empresa_id, emails_norm)

    for email in emails_norm:
        usuario_existente = usuarios_map.get(email)
        if usuario_existente:
            resultados.append(ConviteResultadoItem(email=email, status="ja_cadastrado"))
            continue

        convite_existente = convites_map.get(email)
        if convite_existente is not None and convite_esta_pendente(convite_existente):
            resultados.append(
                ConviteResultadoItem(
                    email=email,
                    status="convite_pendente",
                    expiracao=convite_existente.expiracao.isoformat(),
                )
            )
            continue

        if convite_existente is not None:
            token = _renovar_convite(convite_existente, criado_por)
            audit_log_service.log(
                db,
                acao="convite.renovado",
                usuario_id=criado_por,
                empresa_id=empresa_id,
                alvo=email,
                ip=ip,
            )
            resultados.append(
                ConviteResultadoItem(
                    email=email,
                    status="convite_criado",
                    expiracao=convite_existente.expiracao.isoformat(),
                )
            )
            emails_pendentes.append(ConviteEmailPendente(email=email, token=token))
            continue

        if not empresa_quota_service.pode_adicionar_usuario(
            db,
            empresa,
            reservas_extras=reservas_lote,
        ):
            bloqueados_limite += 1
            emails_bloqueados_limite.append(email)
            resultados.append(
                ConviteResultadoItem(
                    email=email,
                    status="limite_usuarios",
                    email_erro="A empresa atingiu o limite de usuários.",
                )
            )
            continue

        token = _gerar_token()
        convite = Convite(
            empresa_id=empresa_id,
            email=email,
            token=token,
            expiracao=_expiracao_padrao(),
            criado_por=criado_por,
        )
        db.add(convite)
        db.flush()
        reservas_lote += 1
        convites_map[email] = convite

        audit_log_service.log(
            db,
            acao="convite.criado",
            usuario_id=criado_por,
            empresa_id=empresa_id,
            alvo=email,
            ip=ip,
        )

        resultados.append(
            ConviteResultadoItem(
                email=email,
                status="convite_criado",
                expiracao=convite.expiracao.isoformat(),
            )
        )
        emails_pendentes.append(ConviteEmailPendente(email=email, token=token))

    alerta_owners_limite_enviado = False
    if emails_bloqueados_limite:
        ocupacao = empresa_quota_service.ocupacao_atual(db, empresa_id)
        alerta_owners_limite_enviado = email_dispatch_service.notificar_owners_limite_usuarios(
            db,
            empresa_id=empresa_id,
            empresa_nome=empresa_nome,
            max_usuarios=empresa.max_usuarios,
            ocupacao_atual=ocupacao,
            operacao="convites da equipe",
            emails_bloqueados=emails_bloqueados_limite,
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um convite ativo para um dos e-mails informados.",
        ) from None

    response = BulkConviteResponse(
        itens=resultados,
        resumo_envio=ConviteResumoEnvio(
            total=len(resultados),
            enviados=0,
            falhas=0,
            bloqueados_limite=bloqueados_limite,
            alerta_admins_enviado=False,
            alerta_owners_limite_enviado=alerta_owners_limite_enviado,
        ),
    )
    return response, emails_pendentes


async def enviar_emails_bulk_convites(
    empresa_id: int,
    empresa_nome: str,
    pendentes: list[ConviteEmailPendente],
) -> None:
    """Envia convites em background (async).

    Usa httpx.AsyncClient (via tentar_enviar_convite_async) e asyncio.sleep para
    o intervalo entre e-mails, evitando bloquear threads do pool de workers uvicorn.
    """
    if not pendentes:
        return

    intervalo = get_settings().email_bulk_interval_seconds
    db = SessionLocal()
    try:
        falhas_envio: list[email_dispatch_service.FalhaEnvioItem] = []
        for indice, job in enumerate(pendentes):
            resultado_envio = await email_service.tentar_enviar_convite_async(
                db, job.email, job.token, empresa_nome
            )
            if not resultado_envio.sucesso:
                falhas_envio.append(
                    email_dispatch_service.FalhaEnvioItem(
                        destinatario=job.email,
                        operacao="convite",
                        erro=resultado_envio.erro or "Falha desconhecida",
                    )
                )
                logger.warning(
                    "Convite criado para %s, mas o e-mail não foi enviado; reenvie o convite por e-mail",
                    job.email,
                )
            # asyncio.sleep libera o event-loop durante o intervalo entre e-mails,
            # enquanto time.sleep bloquearia o worker thread inteiro.
            if indice < len(pendentes) - 1 and intervalo > 0:
                await asyncio.sleep(intervalo)

        if falhas_envio:
            await email_dispatch_service.notificar_admins_falha_envio_async(
                db,
                empresa_id=empresa_id,
                empresa_nome=empresa_nome,
                operacao="convites da equipe",
                falhas=falhas_envio,
            )
    finally:
        db.close()


async def reenviar_email_convite_background(email: str, token: str, empresa_nome: str) -> None:
    """Reenvia o e-mail de um convite já existente. Cria sua própria sessão DB."""
    db = SessionLocal()
    try:
        await email_service.tentar_enviar_convite_async(db, email, token, empresa_nome)
    finally:
        db.close()


def listar_convites(db: Session, empresa_id: int) -> list[Convite]:
    return list(
        db.scalars(
            select(Convite)
            .where(Convite.empresa_id == empresa_id)
            .order_by(Convite.created_at.desc())
        ).all()
    )


def validar_token(db: Session, token: str) -> Convite:
    convite = _get_convite_ativo(db, token)
    if convite is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido, expirado ou já utilizado",
        )
    return convite


def validar_token_for_update(db: Session, token: str) -> Convite:
    convite = _get_convite_ativo(db, token, for_update=True)
    if convite is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido, expirado ou já utilizado",
        )
    return convite


def marcar_usado(db: Session, convite: Convite) -> None:
    convite.usado_em = datetime.now(UTC)
    db.flush()


def status_convite(convite: Convite) -> str:
    if convite.usado_em is not None:
        return "usado"
    if convite_esta_pendente(convite):
        return "pendente"
    return "expirado"
