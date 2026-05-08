from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.pontuacao_fase import PontuacaoFaseBulkWrite, PontuacaoFaseRead
from app.services import auditoria_admin_service, pontuacao_fase_service

router = APIRouter(prefix="/configuracao-pontuacao-fase", tags=["configuracao-pontuacao-fase"])


@router.get("", response_model=list[PontuacaoFaseRead])
def get_pontuacao_fase(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
) -> list[PontuacaoFaseRead]:
    return pontuacao_fase_service.ensure_defaults(db)


@router.put("", response_model=list[PontuacaoFaseRead])
def put_pontuacao_fase(
    payload: PontuacaoFaseBulkWrite,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
) -> list[PontuacaoFaseRead]:
    try:
        rows = pontuacao_fase_service.substituir_todos(db, payload)
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="pontuacao_fase.put",
            entidade="pontuacao_fase",
            status="success",
            detalhes={"itens": len(rows)},
        )
        return rows
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
