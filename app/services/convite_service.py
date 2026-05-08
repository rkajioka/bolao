import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest
from app.services import audit_log_service, email_service


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
) -> list[dict]:
    resultados = []

    for email in data.emails:
        # Verificar se usuário já existe na empresa
        usuario_existente = db.scalar(
            select(Usuario).where(
                and_(
                    Usuario.email == email,
                    Usuario.empresa_id == empresa_id,
                )
            )
        )
        if usuario_existente:
            resultados.append({"email": email, "status": "ja_cadastrado"})
            continue

        # Verificar convite pendente já existente
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
            resultados.append({
                "email": email,
                "status": "convite_pendente",
                "token": convite_existente.token,
                "expiracao": convite_existente.expiracao.isoformat(),
            })
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

        empresa = db.get(Empresa, empresa_id)
        empresa_nome = empresa.nome if empresa is not None else "Bolão"

        item: dict = {
            "email": email,
            "status": "convite_criado",
            "expiracao": convite.expiracao.isoformat(),
        }
        if email_service.tentar_enviar_convite(db, email, token, empresa_nome):
            item["convite_enviado_por_email"] = True
        else:
            item["token"] = token
            print(
                f"[bolao:email] convite criado para {email}: token na resposta da API (e-mail não enviado ou falhou)",
                flush=True,
            )

        resultados.append(item)

    db.commit()
    return resultados


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
