from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, require_admin
from app.database import get_db
from app.models.pais import Pais
from app.models.usuario import Usuario
from app.schemas.pais import PaisCreate, PaisRead, PaisUpdate
from app.services import pais_service

router = APIRouter(prefix="/paises", tags=["paises"])


@router.get("", response_model=list[PaisRead])
def get_paises(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
    grupo: str | None = Query(
        default=None,
        description="Filtra por letra do grupo (ex.: A). Opcional.",
        max_length=16,
    ),
) -> list[Pais]:
    if grupo is not None and grupo.strip() == "":
        grupo = None
    return pais_service.list_paises(db, grupo=grupo.strip() if grupo else None)


@router.post("", response_model=PaisRead, status_code=status.HTTP_201_CREATED)
def post_pais(
    data: PaisCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Pais:
    try:
        return pais_service.create_pais(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar (possível duplicidade)",
        ) from e


@router.put("/{pais_id}", response_model=PaisRead)
def put_pais(
    pais_id: int,
    data: PaisUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Pais:
    p = pais_service.get_by_id(db, pais_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="País não encontrado")
    try:
        return pais_service.update_pais(db, p, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar (possível duplicidade)",
        ) from e
