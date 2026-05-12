from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, require_admin, require_owner, resolve_empresa_id
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.tema import EmpresaTemaRead, TemaRead, TemaTokens
from app.services import auditoria_admin_service, tema_service

router = APIRouter(tags=["tema"])


@router.get("/plataforma/tema", response_model=TemaRead)
def get_tema_plataforma(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> TemaRead:
    row = tema_service.get_plataforma_tema(db)
    return TemaRead(
        tokens_dark=row.tokens_dark,
        tokens_light=row.tokens_light,
        updated_at=row.updated_at,
    )


@router.put("/plataforma/tema", response_model=TemaRead)
def put_tema_plataforma(
    data: TemaTokens,
    db: Session = Depends(get_db),
    owner: Usuario = Depends(require_owner),
) -> TemaRead:
    try:
        row = tema_service.atualizar_plataforma_tema(db, data.tokens_dark, data.tokens_light)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    auditoria_admin_service.registrar_evento(
        db, owner, acao="plataforma.tema.put", entidade="plataforma_tema", status="success"
    )
    return TemaRead(tokens_dark=row.tokens_dark, tokens_light=row.tokens_light, updated_at=row.updated_at)


@router.get("/empresas/{empresa_id}/tema", response_model=EmpresaTemaRead)
def get_tema_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> EmpresaTemaRead:
    if user.tipo_usuario == "usuario":
        if user.empresa_id != empresa_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    elif user.tipo_usuario == "admin":
        resolve_empresa_id(user, empresa_id)
    row = tema_service.get_empresa_tema(db, empresa_id)
    return EmpresaTemaRead(
        empresa_id=empresa_id,
        tokens_dark=row.tokens_dark,
        tokens_light=row.tokens_light,
        updated_at=row.updated_at,
    )


@router.put("/empresas/{empresa_id}/tema", response_model=EmpresaTemaRead)
def put_tema_empresa(
    empresa_id: int,
    data: TemaTokens,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> EmpresaTemaRead:
    resolve_empresa_id(admin, empresa_id)
    try:
        row = tema_service.atualizar_empresa_tema(db, empresa_id, data.tokens_dark, data.tokens_light)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    auditoria_admin_service.registrar_evento(
        db,
        admin,
        acao="empresa.tema.put",
        entidade="empresa_tema",
        entidade_id=empresa_id,
        status="success",
    )
    return EmpresaTemaRead(
        empresa_id=empresa_id,
        tokens_dark=row.tokens_dark,
        tokens_light=row.tokens_light,
        updated_at=row.updated_at,
    )
