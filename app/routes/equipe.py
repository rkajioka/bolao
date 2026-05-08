from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest
from app.services import convite_service, equipe_service

router = APIRouter(prefix="/equipe", tags=["equipe"])


def _empresa_id_do_admin(admin: Usuario) -> int:
    if admin.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrador não está vinculado a uma empresa",
        )
    return admin.empresa_id


@router.get("/")
def listar_equipe(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> list:
    empresa_id = _empresa_id_do_admin(admin)
    return equipe_service.listar_equipe(db, empresa_id)


@router.post("/convites", status_code=status.HTTP_201_CREATED)
def criar_convites(
    data: BulkConviteRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> list:
    empresa_id = _empresa_id_do_admin(admin)
    ip = request.client.host if request.client else None
    return convite_service.criar_bulk_convites(db, empresa_id, data, admin.id, ip)


@router.get("/convites")
def listar_convites(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> list:
    empresa_id = _empresa_id_do_admin(admin)
    convites = convite_service.listar_convites(db, empresa_id)
    return [
        {
            "id": c.id,
            "email": c.email,
            "token": c.token,
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
) -> dict:
    empresa_id = _empresa_id_do_admin(admin)
    ip = request.client.host if request.client else None
    usuario = equipe_service.bloquear_usuario(db, empresa_id, usuario_id, bloqueado, admin.id, ip)
    return {"id": usuario.id, "bloqueado": usuario.bloqueado}


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_usuario(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> None:
    empresa_id = _empresa_id_do_admin(admin)
    ip = request.client.host if request.client else None
    equipe_service.remover_usuario(db, empresa_id, usuario_id, admin.id, ip)
