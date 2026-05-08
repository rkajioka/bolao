from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.pontuacao_fase import PontuacaoFaseBulkWrite, PontuacaoFaseRead
from app.services import pontuacao_fase_service

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
    _admin: Usuario = Depends(require_admin),
) -> list[PontuacaoFaseRead]:
    try:
        return pontuacao_fase_service.substituir_todos(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
