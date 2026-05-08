from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.empresa import EmpresaCreate, EmpresaRead, EmpresaUpdate
from app.services import empresa_service

router = APIRouter(prefix="/empresas", tags=["empresas"])


@router.get("/", response_model=list[EmpresaRead])
def list_empresas(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list:
    return empresa_service.list_empresas(db)


@router.post("/", response_model=EmpresaRead, status_code=status.HTTP_201_CREATED)
def create_empresa(
    data: EmpresaCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> object:
    try:
        return empresa_service.create_empresa(db, data)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Código de empresa já existe",
        )


@router.get("/{empresa_id}", response_model=EmpresaRead)
def get_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> object:
    empresa = empresa_service.get_by_id(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")
    return empresa


@router.patch("/{empresa_id}", response_model=EmpresaRead)
def update_empresa(
    empresa_id: int,
    data: EmpresaUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> object:
    empresa = empresa_service.get_by_id(db, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")
    return empresa_service.update_empresa(db, empresa, data)
