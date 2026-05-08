from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioRead,
    UsuarioResetPasswordBody,
    UsuarioStatusUpdate,
    UsuarioUpdate,
)
from app.services import auditoria_admin_service, usuario_service

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _integrity_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="E-mail já cadastrado",
    )


@router.get("", response_model=list[UsuarioRead])
def list_usuarios(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[Usuario]:
    return usuario_service.list_usuarios(db)


@router.post("", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def create_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> Usuario:
    try:
        row = usuario_service.create_usuario(db, data)
        auditoria_admin_service.registrar_evento(
            db, admin, acao="usuarios.post", entidade="usuario", entidade_id=row.id, status="success"
        )
        return row
    except IntegrityError as exc:
        auditoria_admin_service.registrar_evento(
            db, admin, acao="usuarios.post", entidade="usuario", status="error", detalhes={"erro": "integrity_error"}
        )
        raise _integrity_error() from exc


@router.get("/{usuario_id}", response_model=UsuarioRead)
def get_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Usuario:
    u = usuario_service.get_by_id(db, usuario_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return u


@router.put("/{usuario_id}", response_model=UsuarioRead)
def put_usuario(
    usuario_id: int,
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> Usuario:
    u = usuario_service.get_by_id(db, usuario_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    try:
        row = usuario_service.update_usuario(db, u, data)
        auditoria_admin_service.registrar_evento(
            db, admin, acao="usuarios.put", entidade="usuario", entidade_id=usuario_id, status="success"
        )
        return row
    except IntegrityError as exc:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="usuarios.put",
            entidade="usuario",
            entidade_id=usuario_id,
            status="error",
            detalhes={"erro": "integrity_error"},
        )
        raise _integrity_error() from exc


@router.patch("/{usuario_id}/status", response_model=UsuarioRead)
def patch_usuario_status(
    usuario_id: int,
    data: UsuarioStatusUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> Usuario:
    u = usuario_service.get_by_id(db, usuario_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    row = usuario_service.set_ativo(db, u, data.ativo)
    auditoria_admin_service.registrar_evento(
        db,
        admin,
        acao="usuarios.patch_status",
        entidade="usuario",
        entidade_id=usuario_id,
        status="success",
        detalhes={"ativo": data.ativo},
    )
    return row


@router.patch("/{usuario_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def patch_reset_password(
    usuario_id: int,
    data: UsuarioResetPasswordBody,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> None:
    u = usuario_service.get_by_id(db, usuario_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    usuario_service.reset_password(db, u, data)
    auditoria_admin_service.registrar_evento(
        db, admin, acao="usuarios.patch_reset_password", entidade="usuario", entidade_id=usuario_id, status="success"
    )
