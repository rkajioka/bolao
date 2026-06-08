from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.core.client_ip import client_ip
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_resolved_empresa_id, is_owner, require_admin
from app.core.config import get_settings
from app.database import get_db
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest, BulkConviteResponse, ProvisionarExpiradosResponse
from app.services import convite_provision_service, convite_service, equipe_service, rate_limit_service, usuario_service

router = APIRouter(prefix="/equipe", tags=["equipe"])


@router.get("", include_in_schema=False)
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


@router.post("/convites/provisionar-expirados", response_model=ProvisionarExpiradosResponse)
def provisionar_convites_expirados(
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
    dry_run: bool = False,
) -> ProvisionarExpiradosResponse:
    """Provisiona em lote convites expirados com senha padrão (equivalente ao script --apply)."""
    resultado = convite_provision_service.provisionar_convites_expirados_lote(
        db,
        empresa_id,
        solicitante_id=admin.id,
        ip=client_ip(request),
        origem="admin",
        dry_run=dry_run,
    )
    return ProvisionarExpiradosResponse(
        total=resultado.total,
        provisionados=resultado.provisionados,
        erros=resultado.erros,
        itens=[
            {"email": item.email, "status": item.status, "detalhe": item.detalhe}
            for item in resultado.itens
        ],
    )


@router.post("/convites/{convite_id}/reenviar", status_code=status.HTTP_204_NO_CONTENT)
def reenviar_convite(
    convite_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    """Reenvia o e-mail de convite; se expirado, renova token e prazo antes."""
    convite = db.scalar(
        select(Convite).where(
            and_(Convite.id == convite_id, Convite.empresa_id == empresa_id)
        )
    )
    if convite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite não encontrado")
    if convite.usado_em is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este convite já foi utilizado",
        )
    if convite_service.convite_esta_pendente(convite):
        token = convite.token
    else:
        token = convite_service.renovar_convite_expirado(
            db,
            convite,
            admin.id,
            empresa_id=empresa_id,
            ip=client_ip(request),
        )
    empresa = db.get(Empresa, empresa_id)
    empresa_nome = empresa.nome if empresa is not None else "Bolão"
    background_tasks.add_task(
        convite_service.reenviar_email_convite_background,
        convite.email,
        token,
        empresa_nome,
    )


@router.post("/convites/{convite_id}/senha-padrao", status_code=status.HTTP_204_NO_CONTENT)
def ativar_convite_senha_padrao(
    convite_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    """Cria ou libera acesso com senha temporária padrão; invalida o link de convite."""
    convite = db.scalar(
        select(Convite).where(
            and_(Convite.id == convite_id, Convite.empresa_id == empresa_id)
        )
    )
    if convite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite não encontrado")

    usuario_existente = db.scalar(select(Usuario).where(Usuario.email == convite.email))
    if usuario_existente is not None:
        if not is_owner(admin) and usuario_existente.tipo_usuario != "usuario":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administradores só podem ativar com senha padrão participantes da própria empresa",
            )

    convite_provision_service.provisionar_convite_senha_padrao_por_id(
        db,
        convite_id,
        empresa_id,
        solicitante_id=admin.id,
        ip=client_ip(request),
        origem="admin",
    )


@router.patch("/{usuario_id}/senha-padrao", status_code=status.HTTP_204_NO_CONTENT)
def reaplicar_senha_padrao_membro(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> None:
    """Reaplica senha temporária padrão para participante aguardando ativação."""
    usuario = equipe_service.get_usuario_empresa(db, empresa_id, usuario_id)
    if not is_owner(admin) and usuario.tipo_usuario != "usuario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administradores só podem ativar com senha padrão participantes da própria empresa",
        )
    convite_provision_service.reaplicar_senha_padrao_usuario(
        db,
        usuario,
        solicitante_id=admin.id,
        ip=client_ip(request),
    )


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
