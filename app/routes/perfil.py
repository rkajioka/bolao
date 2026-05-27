from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.perfil import AlterarSenhaRequest, PerfilUpdate
from app.schemas.usuario import UsuarioRead
from app.services import avatar_upload_service, equipe_service, rate_limit_service, usuario_service

router = APIRouter(prefix="/perfil", tags=["perfil"])
settings = get_settings()


@router.get("/", response_model=UsuarioRead)
def get_perfil(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> UsuarioRead:
    return usuario_service.usuario_para_read(db, user)


@router.patch("/", response_model=UsuarioRead)
def update_perfil(
    data: PerfilUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    return equipe_service.atualizar_perfil(db, user, data)


@router.post("/avatar", response_model=UsuarioRead)
async def upload_avatar(
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
    file: UploadFile = File(...),
) -> UsuarioRead:
    # Rate limit por usuário autenticado (ID) para evitar abuse de upload.
    rate_limit_service.enforce_limit(
        key=f"perfil:avatar:{user.id}",
        limit=settings.rate_limit_avatar_perfil_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    raw = await avatar_upload_service.read_upload_limited(
        file, avatar_upload_service.AVATAR_MAX_BYTES
    )
    ct = file.content_type
    path = avatar_upload_service.persist_avatar(raw, ct)
    row = equipe_service.definir_avatar_url(db, user, path)
    return usuario_service.usuario_para_read(db, row)


@router.delete("/avatar", response_model=UsuarioRead)
def remover_avatar(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> UsuarioRead:
    row = equipe_service.remover_avatar(db, user)
    return usuario_service.usuario_para_read(db, row)


@router.post("/alterar-senha", status_code=204)
def alterar_senha(
    data: AlterarSenhaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    equipe_service.alterar_senha(db, user, data)
