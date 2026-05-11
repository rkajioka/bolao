from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_resolved_empresa_id, require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.configuracao_bolao import ConfiguracaoBolaoRead, ConfiguracaoBolaoWrite
from app.services import auditoria_admin_service, configuracao_bolao_service, pontuacao_service

router = APIRouter(prefix="/configuracao-bolao", tags=["configuracao-bolao"])


@router.get("", response_model=ConfiguracaoBolaoRead)
def get_configuracao_bolao(
    db: Session = Depends(get_db),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> ConfiguracaoBolaoRead:
    config = configuracao_bolao_service.ensure_configuracao_empresa(db, empresa_id)
    return configuracao_bolao_service.configuracao_para_read(db, config)


@router.get("/minha", response_model=ConfiguracaoBolaoRead)
def get_configuracao_bolao_minha(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ConfiguracaoBolaoRead:
    if user.empresa_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário sem empresa")
    config = configuracao_bolao_service.ensure_configuracao_empresa(db, user.empresa_id)
    return configuracao_bolao_service.configuracao_para_read(db, config)


@router.put("", response_model=ConfiguracaoBolaoRead)
def put_configuracao_bolao(
    data: ConfiguracaoBolaoWrite,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> ConfiguracaoBolaoRead:
    try:
        row = configuracao_bolao_service.atualizar_configuracao_empresa(db, empresa_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    pontuacao_service.recalcular_pontuacao_empresa(db, empresa_id)
    auditoria_admin_service.registrar_evento(
        db,
        admin,
        acao="configuracao_bolao.put",
        entidade="configuracao_bolao",
        entidade_id=row.id,
        status="success",
        detalhes={"empresa_id": empresa_id},
    )
    return configuracao_bolao_service.configuracao_para_read(db, row)
