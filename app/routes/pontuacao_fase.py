from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_resolved_empresa_id, require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.pontuacao_fase import PontuacaoFaseBulkWrite, PontuacaoFaseRead
from app.services import auditoria_admin_service, pontuacao_fase_service, pontuacao_service
from app.services.regra_negocio import ConflitoRegraNegocioError

router = APIRouter(prefix="/configuracao-pontuacao-fase", tags=["configuracao-pontuacao-fase"])


@router.get("", response_model=list[PontuacaoFaseRead])
def get_pontuacao_fase(
    db: Session = Depends(get_db),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list[PontuacaoFaseRead]:
    return pontuacao_fase_service.ensure_defaults_empresa(db, empresa_id)


@router.get("/minha", response_model=list[PontuacaoFaseRead])
def get_pontuacao_fase_minha(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[PontuacaoFaseRead]:
    if user.empresa_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário sem empresa",
        )
    return pontuacao_fase_service.ensure_defaults_empresa(db, user.empresa_id)


@router.put("", response_model=list[PontuacaoFaseRead])
def put_pontuacao_fase(
    payload: PontuacaoFaseBulkWrite,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
    empresa_id: int = Depends(get_resolved_empresa_id),
) -> list[PontuacaoFaseRead]:
    try:
        rows = pontuacao_fase_service.substituir_todos_empresa(db, empresa_id, payload)
        pontuacao_service.recalcular_pontuacao_empresa(db, empresa_id)
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="pontuacao_fase.put",
            entidade="pontuacao_fase",
            status="success",
            detalhes={"itens": len(rows), "empresa_id": empresa_id},
        )
        return rows
    except ConflitoRegraNegocioError as e:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="pontuacao_fase.put",
            entidade="pontuacao_fase",
            status="error",
            detalhes={"erro": str(e)},
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except ValueError as e:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="pontuacao_fase.put",
            entidade="pontuacao_fase",
            status="error",
            detalhes={"erro": str(e)},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
