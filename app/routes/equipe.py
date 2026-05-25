from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_resolved_empresa_id, is_owner, require_admin
from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.database import get_db
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest, BulkConviteResponse
from app.services import convite_service, equipe_service, rate_limit_service, usuario_service

router = APIRouter(prefix="/equipe", tags=["equipe"])


@router.get("/")
def listar_equipe(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list:
    return equipe_service.listar_equipe(db, empresa_id)


@router.post(
    "/convites",
    response_model=BulkConviteResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def criar_convites(
    data: BulkConviteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> BulkConviteResponse:
    settings = get_settings()
    rate_limit_service.enforce_limit(
        key=f"convites_bulk:{empresa_id}",
        limit=settings.rate_limit_convites_bulk_requests,
        window_seconds=settings.rate_limit_convites_bulk_window_seconds,
    )
    ip = client_ip(request)
    response, pendentes = convite_service.criar_bulk_convites(db, empresa_id, data, admin.id, ip)
    if pendentes:
        empresa = db.get(Empresa, empresa_id)
        empresa_nome = empresa.nome if empresa is not None else "Bolão"
        background_tasks.add_task(
            convite_service.enviar_emails_bulk_convites,
            empresa_id,
            empresa_nome,
            pendentes,
        )
    return response


@router.get("/convites")
def listar_convites(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list:
    convites = convite_service.listar_convites(db, empresa_id)
    return [
        {
            "id": c.id,
            "email": c.email,
            "expiracao": c.expiracao.isoformat(),
            "status": convite_service.status_convite(c),
            "criado_por": c.criado_por,
            "created_at": c.created_at.isoformat(),
        }
        for c in convites
    ]


@router.patch("/{usuario_id}/bloquear")
def bloquear_usuario(
    usuario_id: int,
    request: Request,
    bloqueado: bool = True,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> dict:
    ip = client_ip(request)
    usuario = equipe_service.bloquear_usuario(db, empresa_id, usuario_id, bloqueado, admin, ip)
    return {"id": usuario.id, "bloqueado": usuario.bloqueado}


@router.patch("/{usuario_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password_membro(
    usuario_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    usuario = equipe_service.get_usuario_empresa(db, empresa_id, usuario_id)
    if not is_owner(admin) and usuario.tipo_usuario != "usuario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administradores só podem redefinir senha de participantes da própria empresa",
        )
    background_tasks.add_task(usuario_service.reset_password_background, usuario.id)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_usuario(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    ip = client_ip(request)
    equipe_service.remover_usuario(db, empresa_id, usuario_id, admin, ip)
