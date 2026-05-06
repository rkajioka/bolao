from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_primeiro_login_concluido
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.palpite_especial import PalpiteEspecialAdminRead, PalpiteEspecialCreate, PalpiteEspecialRead, PalpiteEspecialUpdate
from app.services import palpite_especial_service

router = APIRouter(prefix="/palpites-especiais", tags=["palpites-especiais"])


def _http_from_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc).lower()
    if "não encontrado" in msg:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if "já existe" in msg:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/me", response_model=PalpiteEspecialRead | None)
def get_palpite_especial_me(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> PalpiteEspecialRead | None:
    p = palpite_especial_service.get_por_usuario(db, user.id)
    if p is None:
        return None
    return palpite_especial_service.to_read(db, p)


@router.post("", response_model=PalpiteEspecialRead, status_code=status.HTTP_201_CREATED)
def post_palpite_especial(
    data: PalpiteEspecialCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> PalpiteEspecialRead:
    try:
        row = palpite_especial_service.create_palpite(db, user.id, data)
        return palpite_especial_service.to_read(db, row)
    except ValueError as e:
        raise _http_from_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar (possível duplicidade)",
        ) from e


@router.put("/me", response_model=PalpiteEspecialRead)
def put_palpite_especial_me(
    data: PalpiteEspecialUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> PalpiteEspecialRead:
    try:
        row = palpite_especial_service.update_palpite_me(db, user.id, data)
        return palpite_especial_service.to_read(db, row)
    except ValueError as e:
        raise _http_from_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar",
        ) from e


@router.get("", response_model=list[PalpiteEspecialAdminRead])
def get_palpites_especiais_admin(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[PalpiteEspecialAdminRead]:
    return [palpite_especial_service.to_admin_read(db, p) for p in palpite_especial_service.listar_todos_admin(db)]


@router.patch("/recalcular", status_code=status.HTTP_204_NO_CONTENT)
def patch_palpites_especiais_recalcular(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> None:
    """Recalcula pontuação de todos os palpites especiais (útil após ajustes manuais no banco)."""
    palpite_especial_service.recalcular_palpites_especiais_stub(db)
