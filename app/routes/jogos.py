from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, require_admin
from app.database import get_db
from app.models.jogo import Jogo
from app.models.usuario import Usuario
from app.schemas.jogo import (
    GrupoJogosBlock,
    JogoCreate,
    JogoRead,
    JogoResultadoPatch,
    JogoUpdate,
    JogosPorGrupoResponse,
)
from app.services import jogo_service

router = APIRouter(prefix="/jogos", tags=["jogos"])


@router.get("", response_model=list[JogoRead])
def get_jogos(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> list[Jogo]:
    return jogo_service.list_jogos(db)


@router.get("/cronologico", response_model=list[JogoRead])
def get_jogos_cronologico(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> list[Jogo]:
    return jogo_service.list_jogos_cronologico(db)


@router.get("/grupos", response_model=JogosPorGrupoResponse)
def get_jogos_grupos(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> JogosPorGrupoResponse:
    blocos = [
        GrupoJogosBlock(grupo=grupo, jogos=jogos)
        for grupo, jogos in jogo_service.list_jogos_por_grupo(db)
    ]
    return JogosPorGrupoResponse(grupos=blocos)


@router.get("/mata-mata", response_model=list[JogoRead])
def get_jogos_mata_mata(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> list[Jogo]:
    """Lista jogos do mata-mata cadastrados pelo admin."""
    return jogo_service.list_jogos_mata_mata(db)


@router.get("/brasil", response_model=list[JogoRead])
def get_jogos_brasil(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> list[Jogo]:
    """Jogos em que o Brasil (sigla BR) é casa ou fora — usado na Etapa de marcadores."""
    return jogo_service.list_jogos_brasil(db)


@router.post("", response_model=JogoRead, status_code=status.HTTP_201_CREATED)
def post_jogo(
    data: JogoCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Jogo:
    try:
        return jogo_service.create_jogo(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o jogo (dados inválidos ou referência inexistente)",
        ) from e


@router.put("/{jogo_id}", response_model=JogoRead)
def put_jogo(
    jogo_id: int,
    data: JogoUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Jogo:
    jogo = jogo_service.get_by_id(db, jogo_id)
    if jogo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogo não encontrado")
    try:
        return jogo_service.update_jogo(db, jogo, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o jogo (dados inválidos ou referência inexistente)",
        ) from e


@router.patch("/{jogo_id}/resultado", response_model=JogoRead)
def patch_jogo_resultado(
    jogo_id: int,
    data: JogoResultadoPatch,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Jogo:
    jogo = jogo_service.get_by_id(db, jogo_id)
    if jogo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogo não encontrado")
    try:
        return jogo_service.patch_resultado(db, jogo, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado",
        ) from e


@router.patch("/{jogo_id}/finalizar", response_model=JogoRead)
def patch_jogo_finalizar(
    jogo_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> Jogo:
    jogo = jogo_service.get_by_id(db, jogo_id)
    if jogo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogo não encontrado")
    try:
        return jogo_service.patch_finalizar(db, jogo)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
