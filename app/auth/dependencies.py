"""
Dependências de autenticação e autorização (Etapa 2).
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token_safe
from app.database import get_db
from app.models.usuario import Usuario
from app.services import usuario_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_token_payload(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token não informado",
        )
    payload = decode_access_token_safe(creds.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )
    return payload


def get_current_user_id(payload: dict = Depends(get_token_payload)) -> int:
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem subject")
    try:
        return int(sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Subject inválido",
        ) from exc


def get_current_user(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Usuario:
    user = usuario_service.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )
    return user


def get_current_active_user(user: Usuario = Depends(get_current_user)) -> Usuario:
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    return user


def require_admin(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    if user.tipo_usuario != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user


def require_primeiro_login_concluido(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    """
    Gancho para rotas pós-onboarding (dashboard, palpites, etc.).
    Não utilizado nas rotas desta etapa; aplicar a partir da Etapa 3+.
    """
    if user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conclua o primeiro acesso para continuar",
        )
    return user
