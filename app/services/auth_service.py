import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token_safe
from app.auth.password import hash_password, verify_password
from app.core.password_defaults import SENHA_PADRAO_TEMPORARIA
from app.core.config import get_settings
from app.models.refresh_token import RefreshToken
from app.models.usuario import Usuario
from app.schemas.usuario import ChangePasswordRequest, LoginRequest, PrimeiroAcessoRequest
from app.services import audit_log_service, usuario_service

logger = logging.getLogger(__name__)
settings = get_settings()

_LOGIN_FAIL_MSG = "E-mail ou senha incorretos"


def _refresh_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.jwt_refresh_token_expire_minutes)


def _is_expired(ts: datetime) -> bool:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return ts <= datetime.now(UTC)


def issue_token_pair(db: Session, user: Usuario) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    refresh_token, jti = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            usuario_id=user.id,
            jti=jti,
            expires_at=_refresh_expires_at(),
            revogado=False,
        )
    )
    db.commit()
    return access_token, refresh_token


def login(db: Session, data: LoginRequest) -> tuple[str, str, bool]:
    user = usuario_service.get_by_email(db, str(data.email))
    if user is None or not verify_password(data.senha, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAIL_MSG,
        )
    if not user.ativo:
        logger.warning("Login recusado: usuário inativo (email=%s)", data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAIL_MSG,
        )
    if user.bloqueado:
        logger.warning("Login recusado: usuário bloqueado (email=%s)", data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAIL_MSG,
        )
    access_token, refresh_token = issue_token_pair(db, user)
    return access_token, refresh_token, user.primeiro_login


def refresh_access_token(
    db: Session,
    refresh_token: str,
    *,
    ip: str | None = None,
) -> tuple[str, str]:
    payload = decode_refresh_token_safe(refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )
    sub = payload.get("sub")
    jti = payload.get("jti")
    try:
        user_id = int(sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        ) from exc
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    token_row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.usuario_id == user_id,
            RefreshToken.jti == str(jti),
        )
    )
    if token_row is None:
        reused = db.scalar(
            select(RefreshToken).where(
                RefreshToken.usuario_id == user_id,
                RefreshToken.jti == str(jti),
                RefreshToken.revogado.is_(True),
            )
        )
        if reused is not None:
            revogar_refresh_tokens_usuario(db, user_id)
            audit_log_service.log(
                db,
                acao="auth.refresh_replay_detectado",
                usuario_id=user_id,
                ip=ip,
            )
            logger.warning(
                "Replay de refresh token detectado — revogando família (usuario_id=%s, ip=%s)",
                user_id,
                ip,
            )
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )
    if _is_expired(token_row.expires_at):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )
    if token_row.revogado:
        # Token already used — possible replay attack; revoke all sessions and log
        revogar_refresh_tokens_usuario(db, user_id)
        audit_log_service.log(
            db,
            acao="security.refresh_token_replay",
            usuario_id=user_id,
            ip=ip,
            metadata={"jti": str(jti)},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )

    user = usuario_service.get_by_id(db, user_id)
    if user is None or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inválido para refresh",
        )
    if user.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário bloqueado pelo administrador",
        )

    token_row.revogado = True
    new_access_token = create_access_token(user.id)
    new_refresh_token, new_jti = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            usuario_id=user.id,
            jti=new_jti,
            expires_at=_refresh_expires_at(),
            revogado=False,
        )
    )
    db.commit()
    return new_access_token, new_refresh_token


def revogar_refresh_tokens_usuario(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.usuario_id == user_id,
            RefreshToken.revogado.is_(False),
        )
        .values(revogado=True)
    )


def logout(db: Session, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    payload = decode_refresh_token_safe(refresh_token)
    if payload is None:
        return
    jti = payload.get("jti")
    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        return
    if not jti:
        return
    token_row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.usuario_id == user_id,
            RefreshToken.jti == str(jti),
            RefreshToken.revogado.is_(False),
        )
    )
    if token_row is None:
        return
    token_row.revogado = True
    db.commit()


def complete_primeiro_acesso(db: Session, user: Usuario, data: PrimeiroAcessoRequest) -> None:
    if not user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primeiro acesso já foi concluído",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    if data.nova_senha == SENHA_PADRAO_TEMPORARIA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escolha uma senha diferente da senha temporária padrão",
        )
    user.nome = data.nome
    user.funcao = data.funcao
    user.senha_hash = hash_password(data.nova_senha)
    user.primeiro_login = False
    db.commit()


def change_password(db: Session, user: Usuario, data: ChangePasswordRequest) -> None:
    if user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conclua o primeiro acesso antes de usar esta rota",
        )
    if not verify_password(data.senha_atual, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    if data.senha_atual == data.nova_senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ser diferente da senha atual",
        )
    user.senha_hash = hash_password(data.nova_senha)
    revogar_refresh_tokens_usuario(db, user.id)
    db.commit()
