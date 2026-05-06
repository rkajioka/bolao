from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_primeiro_login_concluido
from app.database import get_db
from app.models.palpite_jogo import PalpiteJogo
from app.models.usuario import Usuario
from app.schemas.palpite_jogo import PalpiteJogoCreate, PalpiteJogoRead, PalpiteJogoUpdate
from app.services import palpite_jogo_service

router = APIRouter(prefix="/palpites-jogos", tags=["palpites-jogos"])


def _http_from_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc).lower()
    if "não encontrado" in msg:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if "já possui palpite" in msg:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/me", response_model=list[PalpiteJogoRead])
def get_palpites_me(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> list[PalpiteJogo]:
    return palpite_jogo_service.list_me(db, user.id)


@router.post("", response_model=PalpiteJogoRead, status_code=status.HTTP_201_CREATED)
def post_palpite_jogo(
    data: PalpiteJogoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> PalpiteJogo:
    try:
        return palpite_jogo_service.create_palpite(db, user.id, data)
    except ValueError as e:
        raise _http_from_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o palpite (possível duplicidade)",
        ) from e


@router.put("/{palpite_id}", response_model=PalpiteJogoRead)
def put_palpite_jogo(
    palpite_id: int,
    data: PalpiteJogoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> PalpiteJogo:
    try:
        return palpite_jogo_service.update_palpite(db, user.id, palpite_id, data)
    except ValueError as e:
        raise _http_from_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o palpite",
        ) from e
