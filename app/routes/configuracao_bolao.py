from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.configuracao_bolao import ConfiguracaoBolaoRead, ConfiguracaoBolaoWrite
from app.services import auditoria_admin_service, configuracao_bolao_service

router = APIRouter(prefix="/configuracao-bolao", tags=["configuracao-bolao"])


@router.get("", response_model=ConfiguracaoBolaoRead)
def get_configuracao_bolao(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> ConfiguracaoBolaoRead:
    return configuracao_bolao_service.ensure_primeira_configuracao(db)


@router.put("", response_model=ConfiguracaoBolaoRead)
def put_configuracao_bolao(
    data: ConfiguracaoBolaoWrite,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> ConfiguracaoBolaoRead:
    row = configuracao_bolao_service.atualizar_configuracao(db, data)
    auditoria_admin_service.registrar_evento(
        db,
        admin,
        acao="configuracao_bolao.put",
        entidade="configuracao_bolao",
        entidade_id=row.id,
        status="success",
    )
    return row
