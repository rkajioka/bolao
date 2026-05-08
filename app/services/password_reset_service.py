import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.models.password_reset import PasswordReset
from app.models.usuario import Usuario
from app.services import audit_log_service, email_service, usuario_service


_TOKEN_BYTES = 48
_EXPIRACAO_MINUTOS = 60


def _gerar_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def _expiracao() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=_EXPIRACAO_MINUTOS)


def solicitar_reset(
    db: Session,
    email: str,
    ip: str | None = None,
) -> str | None:
    """
    Retorna o token gerado (para exibição dev/admin) ou None se e-mail não existe.
    NUNCA lança exceção que revele existência do e-mail — chamador deve retornar
    resposta genérica independente.
    """
    usuario = usuario_service.get_by_email(db, email)
    if usuario is None or not usuario.ativo:
        return None

    # Invalida tokens anteriores do usuário
    tokens_antigos = list(
        db.scalars(
            select(PasswordReset).where(
                and_(
                    PasswordReset.usuario_id == usuario.id,
                    PasswordReset.usado.is_(False),
                )
            )
        ).all()
    )
    for t in tokens_antigos:
        t.usado = True
    db.flush()

    token = _gerar_token()
    pr = PasswordReset(
        usuario_id=usuario.id,
        token=token,
        expiracao=_expiracao(),
    )
    db.add(pr)

    audit_log_service.log(
        db,
        acao="password_reset.solicitado",
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
        ip=ip,
    )

    db.commit()
    email_service.tentar_enviar_reset_senha(db, email, token)
    return token


def redefinir_senha(
    db: Session,
    token: str,
    nova_senha: str,
    ip: str | None = None,
) -> None:
    agora = datetime.now(UTC)
    pr = db.scalar(
        select(PasswordReset).where(
            and_(
                PasswordReset.token == token,
                PasswordReset.usado.is_(False),
                PasswordReset.expiracao > agora,
            )
        )
    )
    if pr is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado",
        )

    usuario = db.get(Usuario, pr.usuario_id)
    if usuario is None or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário não encontrado",
        )

    usuario.senha_hash = hash_password(nova_senha)
    pr.usado = True

    audit_log_service.log(
        db,
        acao="password_reset.concluido",
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
        ip=ip,
    )

    db.commit()
