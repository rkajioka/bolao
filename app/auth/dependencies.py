"""
Dependências de autenticação.

A validação completa de usuário ativo, primeiro_login e tipo_usuario nas rotas
será implementada na Etapa 2 (Usuários e Login). Aqui ficam apenas os hooks mínimos.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import decode_access_token_safe

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


def require_admin(_payload: dict = Depends(get_token_payload)) -> None:
    """Stub: checagem real de tipo_usuario no banco na Etapa 2."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Autorização admin será aplicada na Etapa 2",
    )
