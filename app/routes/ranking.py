from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.ranking import RankingInsightsRead, RankingLinhaRead, RankingResponse
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
            campeao_id=ln.campeao_id,
            vice_campeao_id=ln.vice_campeao_id,
            terceiro_lugar_id=ln.terceiro_lugar_id,
            artilheiro_pais_id=ln.artilheiro_pais_id,
            pontos_jogos=ln.pontos_jogos,
            pontos_especiais=ln.pontos_especiais,
            bonus_brasil=ln.bonus_brasil,
            pontos_totais=ln.pontos_totais,
        )
        for i, ln in enumerate(linhas_svc)
    ]
    return RankingResponse(linhas=linhas)


@router.get("/insights", response_model=RankingInsightsRead)
def get_ranking_insights(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> RankingInsightsRead:
    data = ranking_service.obter_insights_periodo(db, user.id)
    return RankingInsightsRead(
        periodo_label=data.periodo_label,
        periodo_tipo=data.periodo_tipo,
        jogos_periodo=data.jogos_periodo,
        destaques_resultado=data.destaques_resultado,
        destaques_placar_exato=data.destaques_placar_exato,
        destaques_marcadores_br=data.destaques_marcadores_br,
        meu_preenchidos=data.meu_preenchidos,
        meu_acertos_resultado=data.meu_acertos_resultado,
        meu_acertos_placar_exato=data.meu_acertos_placar_exato,
        meu_bonus_marcadores_br=data.meu_bonus_marcadores_br,
        meus_pontos_periodo=data.meus_pontos_periodo,
    )
