from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token_safe
from app.auth.password import hash_password, verify_password
from app.core.config import get_settings
from app.models.refresh_token import RefreshToken
from app.models.usuario import Usuario
from app.schemas.usuario import ChangePasswordRequest, LoginRequest, PrimeiroAcessoRequest
from app.services import usuario_service

settings = get_settings()


def _refresh_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.jwt_refresh_token_expire_minutes)


def _is_expired(ts: datetime) -> bool:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return ts <= datetime.now(UTC)


def _issue_token_pair(db: Session, user: Usuario) -> tuple[str, str]:
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
            detail="E-mail ou senha incorretos",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    access_token, refresh_token = _issue_token_pair(db, user)
    return access_token, refresh_token, user.primeiro_login


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
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
            RefreshToken.revogado.is_(False),
        )
    )
    if token_row is None or _is_expired(token_row.expires_at):
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

    token_row.revogado = True
    access_token = create_access_token(user.id)
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
    return access_token, new_refresh_token


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
    user.nome = data.nome
    user.funcao = data.funcao
    user.imagem_perfil = data.imagem_perfil
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
    db.commit()
