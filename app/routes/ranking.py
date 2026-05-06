from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.ranking import RankingLinhaRead, RankingResponse
from app.services import ranking_service

router = APIRouter(prefix="/ranking", tags=["ranking"])


@router.get("", response_model=RankingResponse)
def get_ranking(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> RankingResponse:
    linhas_svc = ranking_service.listar_ranking(db)
    linhas = [
        RankingLinhaRead(
            posicao=i + 1,
            usuario_id=ln.usuario_id,
            nome=ln.nome,
            funcao=ln.funcao,
            imagem_perfil=ln.imagem_perfil,
            pontos_jogos=ln.pontos_jogos,
            pontos_especiais=ln.pontos_especiais,
            bonus_brasil=ln.bonus_brasil,
            pontos_totais=ln.pontos_totais,
        )
        for i, ln in enumerate(linhas_svc)
    ]
    return RankingResponse(linhas=linhas)
