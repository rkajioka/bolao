from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.perfil import AlterarSenhaRequest, PerfilUpdate
from app.schemas.usuario import UsuarioRead
from app.services import equipe_service

router = APIRouter(prefix="/perfil", tags=["perfil"])


@router.get("/", response_model=UsuarioRead)
def get_perfil(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    return user


@router.patch("/", response_model=UsuarioRead)
def update_perfil(
    data: PerfilUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    return equipe_service.atualizar_perfil(db, user, data)


@router.post("/alterar-senha", status_code=204)
def alterar_senha(
    data: AlterarSenhaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    equipe_service.alterar_senha(db, user, data)
