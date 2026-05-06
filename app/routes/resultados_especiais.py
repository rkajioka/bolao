from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.resultado_especial import ResultadoEspecial
from app.models.usuario import Usuario
from app.schemas.resultado_especial import ResultadoEspecialRead, ResultadoEspecialWrite
from app.services import resultado_especial_service

router = APIRouter(prefix="/resultados-especiais", tags=["resultados-especiais"])


def _http(exc: ValueError) -> HTTPException:
    msg = str(exc).lower()
    if "não encontrado" in msg:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if "já existe" in msg:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=ResultadoEspecialRead | None)
def get_resultado_especial(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> ResultadoEspecial | None:
    return resultado_especial_service.obter_singleton(db)


@router.post("", response_model=ResultadoEspecialRead, status_code=status.HTTP_201_CREATED)
def post_resultado_especial(
    data: ResultadoEspecialWrite,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> ResultadoEspecial:
    try:
        return resultado_especial_service.criar(db, data)
    except ValueError as e:
        raise _http(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado especial",
        ) from e


@router.put("", response_model=ResultadoEspecialRead)
def put_resultado_especial(
    data: ResultadoEspecialWrite,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> ResultadoEspecial:
    try:
        return resultado_especial_service.atualizar(db, data)
    except ValueError as e:
        raise _http(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado especial",
        ) from e


@router.patch("/finalizar", response_model=ResultadoEspecialRead)
def patch_resultado_especial_finalizar(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> ResultadoEspecial:
    try:
        return resultado_especial_service.finalizar(db)
    except ValueError as e:
        raise _http(e) from e
