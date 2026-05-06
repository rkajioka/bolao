from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_primeiro_login_concluido
from app.database import get_db
from app.models.marcador_brasil import MarcadorBrasilPalpite, MarcadorBrasilResultado
from app.models.usuario import Usuario
from app.schemas.marcador_brasil import (
    MarcadorBrasilPalpiteRead,
    MarcadorBrasilResultadoRead,
    MarcadoresBrasilPalpiteSync,
    MarcadoresBrasilResultadoSync,
)
from app.services import marcador_brasil_service

router = APIRouter(prefix="/marcadores-brasil", tags=["marcadores-brasil"])


def _http_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc).lower()
    if "não encontrado" in msg:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/me/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def get_marcadores_me_jogo(
    jogo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> list[MarcadorBrasilPalpite]:
    try:
        marcador_brasil_service.obter_jogo_que_envolve_brasil(db, jogo_id)
    except ValueError as e:
        raise _http_value_error(e) from e
    return marcador_brasil_service.listar_marcadores_palpite_usuario(db, user.id, jogo_id)


@router.post("/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def post_marcadores_jogo(
    jogo_id: int,
    body: MarcadoresBrasilPalpiteSync,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> list[MarcadorBrasilPalpite]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_palpite(db, user.id, jogo_id, body.marcadores)
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar os marcadores",
        ) from e


@router.put("/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def put_marcadores_jogo(
    jogo_id: int,
    body: MarcadoresBrasilPalpiteSync,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> list[MarcadorBrasilPalpite]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_palpite(db, user.id, jogo_id, body.marcadores)
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar os marcadores",
        ) from e


@router.get("/admin/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def get_marcadores_resultado_admin(
    jogo_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[MarcadorBrasilResultado]:
    try:
        return marcador_brasil_service.listar_marcadores_resultado_admin(db, jogo_id)
    except ValueError as e:
        raise _http_value_error(e) from e


@router.post("/resultado/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def post_marcadores_resultado(
    jogo_id: int,
    body: MarcadoresBrasilResultadoSync,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[MarcadorBrasilResultado]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_resultado_admin(db, jogo_id, body)
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado dos marcadores",
        ) from e


@router.put("/resultado/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def put_marcadores_resultado(
    jogo_id: int,
    body: MarcadoresBrasilResultadoSync,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[MarcadorBrasilResultado]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_resultado_admin(db, jogo_id, body)
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado dos marcadores",
        ) from e


@router.patch("/recalcular/{jogo_id}", status_code=status.HTTP_204_NO_CONTENT)
def patch_recalcular_marcadores(
    jogo_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> None:
    """Recalcula pontuação dos palpites do jogo (inclui bônus de marcadores do Brasil)."""
    try:
        marcador_brasil_service.obter_jogo_que_envolve_brasil(db, jogo_id)
    except ValueError as e:
        raise _http_value_error(e) from e
    marcador_brasil_service.recalcular_marcadores_brasil_stub(db, jogo_id)
