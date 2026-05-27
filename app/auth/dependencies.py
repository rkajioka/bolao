"""
Dependências de autenticação e autorização.
"""

from fastapi import Depends, HTTPException, Query, status
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
    if user.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário bloqueado pelo administrador",
        )
    return user


def is_owner(user: Usuario) -> bool:
    return user.tipo_usuario == "owner"


def is_admin_or_owner(user: Usuario) -> bool:
    return user.tipo_usuario in {"admin", "owner"}


def require_owner(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    if not is_owner(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a proprietários da plataforma",
        )
    return user


def require_admin(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    if not is_admin_or_owner(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user


def _assert_empresa_exists(db: Session, empresa_id: int) -> None:
    """Levanta 404 se a empresa não existir. Usado para validar empresa_id vindo do owner."""
    from app.models.empresa import Empresa

    if db.get(Empresa, empresa_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa não encontrada",
        )


def resolve_empresa_id(
    user: Usuario,
    empresa_id: int | None = None,
) -> int:
    if is_owner(user):
        if empresa_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="empresa_id é obrigatório para proprietários da plataforma",
            )
        return empresa_id
    if user.tipo_usuario != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    if user.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrador sem bolão vinculado",
        )
    if empresa_id is not None and empresa_id != user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao seu bolão",
        )
    return user.empresa_id


def get_resolved_empresa_id(
    empresa_id: int | None = Query(default=None),
    user: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> int:
    resolved = resolve_empresa_id(user, empresa_id)
    # Quando o owner passa um empresa_id (tipicamente do localStorage), valida
    # que a empresa de fato existe no banco — evita operar em IDs fantasmas.
    if is_owner(user):
        _assert_empresa_exists(db, resolved)
    return resolved


def require_primeiro_login_concluido(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    """Rotas pós-onboarding: exige primeiro acesso concluído."""
    if user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conclua o primeiro acesso para continuar",
        )
    return user


def require_participante_bolao(user: Usuario = Depends(require_primeiro_login_concluido)) -> Usuario:
    if is_owner(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Proprietário da plataforma não participa do bolão",
        )
    if user.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participação no bolão indisponível nesta conta",
        )
    return user


def get_empresa_id(user: Usuario = Depends(get_current_active_user)) -> int:
    """Retorna empresa_id do usuário autenticado. Garante isolamento tenant."""
    if user.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participação no bolão indisponível nesta conta",
        )
    return user.empresa_id


def get_ranking_empresa_id(
    empresa_id: int | None = Query(default=None),
    user: Usuario = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> int:
    if is_owner(user):
        resolved = resolve_empresa_id(user, empresa_id)
        _assert_empresa_exists(db, resolved)
        return resolved
    if user.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participação no bolão indisponível nesta conta",
        )
    return user.empresa_id
