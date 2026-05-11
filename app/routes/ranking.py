from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_ranking_empresa_id
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.ranking import (
    DestaquesUsuariosRead,
    InsightDestaqueRead,
    InsightMetricaEmpresaRead,
    RankingInsightsRead,
    RankingLinhaRead,
    RankingResponse,
)
from app.services import ranking_service

router = APIRouter(prefix="/ranking", tags=["ranking"])


def _destaques_read(destaques) -> DestaquesUsuariosRead:
    return DestaquesUsuariosRead(
        pontos_bloco=[
            InsightDestaqueRead(usuario_id=d.usuario_id, nome=d.nome, valor=d.valor)
            for d in destaques.pontos_bloco
        ],
        placar_exato=[
            InsightDestaqueRead(usuario_id=d.usuario_id, nome=d.nome, valor=d.valor)
            for d in destaques.placar_exato
        ],
        resultado=[
            InsightDestaqueRead(usuario_id=d.usuario_id, nome=d.nome, valor=d.valor)
            for d in destaques.resultado
        ],
        classificado=[
            InsightDestaqueRead(usuario_id=d.usuario_id, nome=d.nome, valor=d.valor)
            for d in destaques.classificado
        ],
    )


@router.get("", response_model=RankingResponse)
def get_ranking(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
    empresa_id: int = Depends(get_ranking_empresa_id),
) -> RankingResponse:
    linhas_svc = ranking_service.listar_ranking(db, empresa_id)
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
    empresa_id: int = Depends(get_ranking_empresa_id),
) -> RankingInsightsRead:
    data = ranking_service.obter_insights_periodo(db, user.id, empresa_id=empresa_id)
    return RankingInsightsRead(
        periodo_chave=data.periodo_chave,
        periodo_label=data.periodo_label,
        periodo_tipo=data.periodo_tipo,
        periodo_status=data.periodo_status,
        periodo_em_andamento_label=data.periodo_em_andamento_label,
        jogos_periodo=data.jogos_periodo,
        participantes_empresa=data.participantes_empresa,
        participantes_com_palpite_no_bloco=data.participantes_com_palpite_no_bloco,
        metricas_empresa=[
            InsightMetricaEmpresaRead(
                chave=m.chave,
                label=m.label,
                valor=m.valor,
                total=m.total,
            )
            for m in data.metricas_empresa
        ],
        destaques_usuarios=_destaques_read(data.destaques_usuarios),
        meu_preenchidos=data.meu_preenchidos,
        meu_acertos_resultado=data.meu_acertos_resultado,
        meu_acertos_placar_exato=data.meu_acertos_placar_exato,
        meus_acertos_classificado=data.meus_acertos_classificado,
        meus_pontos_periodo=data.meus_pontos_periodo,
        minha_posicao_periodo=data.minha_posicao_periodo,
    )
