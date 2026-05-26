from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_resolved_empresa_id, is_owner, require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest, BulkConviteResponse
from app.services import convite_service, equipe_service, usuario_service
from app.services.rate_limit_service import enforce_limit

router = APIRouter(prefix="/equipe", tags=["equipe"])


@router.get("/")
def listar_equipe(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list:
    return equipe_service.listar_equipe(db, empresa_id)


@router.post(
    "/convites",
    response_model=BulkConviteResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def criar_convites(
    data: BulkConviteRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> BulkConviteResponse:
    enforce_limit(
        key=f"equipe:convites:{empresa_id}",
        limit=1,
        window_seconds=300,
    )
    ip = request.client.host if request.client else None
    return convite_service.criar_bulk_convites(db, empresa_id, data, admin.id, ip)


@router.get("/convites")
def listar_convites(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list:
    convites = convite_service.listar_convites(db, empresa_id)
    return [
        {
            "id": c.id,
            "email": c.email,
            "expiracao": c.expiracao.isoformat(),
            "status": convite_service.status_convite(c),
            "criado_por": c.criado_por,
            "created_at": c.created_at.isoformat(),
        }
        for c in convites
    ]


@router.patch("/{usuario_id}/bloquear")
def bloquear_usuario(
    usuario_id: int,
    request: Request,
    bloqueado: bool = True,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> dict:
    ip = request.client.host if request.client else None
    usuario = equipe_service.bloquear_usuario(db, empresa_id, usuario_id, bloqueado, admin, ip)
    return {"id": usuario.id, "bloqueado": usuario.bloqueado}


@router.patch("/{usuario_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password_membro(
    usuario_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    usuario = equipe_service.get_usuario_empresa(db, empresa_id, usuario_id)
    if not is_owner(admin) and usuario.tipo_usuario != "usuario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administradores só podem redefinir senha de participantes da própria empresa",
        )
    usuario_service.reset_password(db, usuario)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_usuario(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    ip = request.client.host if request.client else None
    equipe_service.remover_usuario(db, empresa_id, usuario_id, admin, ip)
