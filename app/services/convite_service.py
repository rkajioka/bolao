import secrets
import time
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest, BulkConviteResponse, ConviteResumoEnvio, ConviteResultadoItem
from app.services import audit_log_service, email_dispatch_service, email_service


_TOKEN_BYTES = 48
_EXPIRACAO_HORAS = 72


def _gerar_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def _expiracao_padrao() -> datetime:
    return datetime.now(UTC) + timedelta(hours=_EXPIRACAO_HORAS)


def _get_convite_ativo(db: Session, token: str) -> Convite | None:
    agora = datetime.now(UTC)
    return db.scalar(
        select(Convite).where(
            and_(
                Convite.token == token,
                Convite.usado_em.is_(None),
                Convite.expiracao > agora,
            )
        )
    )


def criar_bulk_convites(
    db: Session,
    empresa_id: int,
    data: BulkConviteRequest,
    criado_por: int,
    ip: str | None = None,
) -> BulkConviteResponse:
    resultados: list[ConviteResultadoItem] = []
    falhas_envio: list[email_dispatch_service.FalhaEnvioItem] = []
    enviados = 0
    falhas = 0
    intervalo = get_settings().email_bulk_interval_seconds

    empresa = db.get(Empresa, empresa_id)
    empresa_nome = empresa.nome if empresa is not None else "Bolão"

    for indice, email in enumerate(data.emails):
        usuario_existente = db.scalar(
            select(Usuario).where(
                and_(
                    Usuario.email == email,
                    Usuario.empresa_id == empresa_id,
                )
            )
        )
        if usuario_existente:
            resultados.append(ConviteResultadoItem(email=email, status="ja_cadastrado"))
            continue

        agora = datetime.now(UTC)
        convite_existente = db.scalar(
            select(Convite).where(
                and_(
                    Convite.email == email,
                    Convite.empresa_id == empresa_id,
                    Convite.usado_em.is_(None),
                    Convite.expiracao > agora,
                )
            )
        )
        if convite_existente:
            resultados.append(
                ConviteResultadoItem(
                    email=email,
                    status="convite_pendente",
                    token=convite_existente.token,
                    expiracao=convite_existente.expiracao.isoformat(),
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

        audit_log_service.log(
            db,
            acao="convite.criado",
            usuario_id=criado_por,
            empresa_id=empresa_id,
            alvo=email,
            ip=ip,
        )

        item = ConviteResultadoItem(
            email=email,
            status="convite_criado",
            expiracao=convite.expiracao.isoformat(),
        )
        resultado_envio = email_service.tentar_enviar_convite(db, email, token, empresa_nome)
        item.email_tentativas = resultado_envio.tentativas
        if resultado_envio.sucesso:
            item.convite_enviado_por_email = True
            enviados += 1
        else:
            item.convite_enviado_por_email = False
            item.email_erro = resultado_envio.erro
            item.token = token
            falhas += 1
            falhas_envio.append(
                email_dispatch_service.FalhaEnvioItem(
                    destinatario=email,
                    operacao="convite",
                    erro=resultado_envio.erro or "Falha desconhecida",
                )
            )
            print(
                f"[bolao:email] convite criado para {email}: token na resposta da API (e-mail não enviado)",
                flush=True,
            )

        resultados.append(item)

        if indice < len(data.emails) - 1 and intervalo > 0:
            time.sleep(intervalo)

    alerta_admins_enviado = False
    if falhas_envio:
        alerta_admins_enviado = email_dispatch_service.notificar_admins_falha_envio(
            db,
            empresa_id=empresa_id,
            empresa_nome=empresa_nome,
            operacao="convites da equipe",
            falhas=falhas_envio,
        )

    db.commit()
    return BulkConviteResponse(
        itens=resultados,
        resumo_envio=ConviteResumoEnvio(
            total=len(resultados),
            enviados=enviados,
            falhas=falhas,
            alerta_admins_enviado=alerta_admins_enviado,
        ),
    )


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


def marcar_usado(db: Session, convite: Convite) -> None:
    convite.usado_em = datetime.now(UTC)
    db.flush()


def status_convite(convite: Convite) -> str:
    if convite.usado_em is not None:
        return "usado"
    agora = datetime.now(UTC)
    exp = convite.expiracao
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    if exp <= agora:
        return "expirado"
    return "pendente"
