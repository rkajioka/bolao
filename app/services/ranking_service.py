"""
Ranking geral — agregação em tempo real (§12, §24). Não persiste tabela de ranking no MVP.

Componentes: palpites de jogos (sem bônus Brasil) + bônus marcadores Brasil + palpites especiais.
Ordenação: maior total; desempate não definido no MD → nome (ordem alfabética).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.jogo import Jogo
from app.models.marcador_brasil import MarcadorBrasilPalpite
from app.models.palpite_especial import PalpiteEspecial
from app.models.palpite_jogo import PalpiteJogo
from app.models.usuario import Usuario


@dataclass(frozen=True)
class LinhaRankingInterna:
    usuario_id: int
    nome: str
    funcao: str | None
    imagem_perfil: str | None
    campeao_id: int | None
    vice_campeao_id: int | None
    terceiro_lugar_id: int | None
    artilheiro_pais_id: int | None
    pontos_jogos: int
    pontos_especiais: int
    bonus_brasil: int
    pontos_totais: int


@dataclass(frozen=True)
class InsightDestaqueInterno:
    usuario_id: int
    nome: str
    valor: int


@dataclass(frozen=True)
class RankingInsightsInterno:
    periodo_label: str
    periodo_tipo: str
    jogos_periodo: int
    destaques_resultado: list[InsightDestaqueInterno]
    destaques_placar_exato: list[InsightDestaqueInterno]
    destaques_marcadores_br: list[InsightDestaqueInterno]
    meu_preenchidos: int
    meu_acertos_resultado: int
    meu_acertos_placar_exato: int
    meu_bonus_marcadores_br: int
    meus_pontos_periodo: int


def listar_ranking(db: Session) -> list[LinhaRankingInterna]:
    """
    Lista usuários ativos com pontuação agregada.
    Usuários sem palpites aparecem com zeros nos componentes de pontos.
    """
    agg_jogos = (
        select(
            PalpiteJogo.usuario_id.label("usuario_id"),
            func.coalesce(
                func.sum(
                    PalpiteJogo.pontuacao_placar
                    + PalpiteJogo.pontuacao_resultado
                    + PalpiteJogo.pontuacao_classificado
                ),
                0,
            ).label("pontos_jogos"),
            func.coalesce(func.sum(PalpiteJogo.pontuacao_marcadores_brasil), 0).label("bonus_brasil"),
        )
        .group_by(PalpiteJogo.usuario_id)
        .subquery()
    )

    pj = func.coalesce(agg_jogos.c.pontos_jogos, 0)
    pb = func.coalesce(agg_jogos.c.bonus_brasil, 0)
    pe = func.coalesce(PalpiteEspecial.pontuacao_total, 0)
    total_expr = pj + pb + pe

    stmt = (
        select(
            Usuario.id.label("usuario_id"),
            Usuario.nome,
            Usuario.funcao,
            Usuario.imagem_perfil,
            PalpiteEspecial.campeao_id,
            PalpiteEspecial.vice_campeao_id,
            PalpiteEspecial.terceiro_lugar_id,
            PalpiteEspecial.artilheiro_pais_id,
            pj.label("pontos_jogos"),
            pe.label("pontos_especiais"),
            pb.label("bonus_brasil"),
            total_expr.label("pontos_totais"),
        )
        .select_from(Usuario)
        .outerjoin(agg_jogos, agg_jogos.c.usuario_id == Usuario.id)
        .outerjoin(PalpiteEspecial, PalpiteEspecial.usuario_id == Usuario.id)
        .where(Usuario.ativo.is_(True))
        .order_by(total_expr.desc(), Usuario.nome.asc())
    )

    rows = db.execute(stmt).all()
    return [
        LinhaRankingInterna(
            usuario_id=int(r.usuario_id),
            nome=str(r.nome),
            funcao=r.funcao,
            imagem_perfil=r.imagem_perfil,
            campeao_id=r.campeao_id,
            vice_campeao_id=r.vice_campeao_id,
            terceiro_lugar_id=r.terceiro_lugar_id,
            artilheiro_pais_id=r.artilheiro_pais_id,
            pontos_jogos=int(r.pontos_jogos),
            pontos_especiais=int(r.pontos_especiais),
            bonus_brasil=int(r.bonus_brasil),
            pontos_totais=int(r.pontos_totais),
        )
        for r in rows
    ]


def _resolver_periodo_atual(db: Session) -> tuple[str, str, list[int]]:
    jogos_finalizados = list(
        db.scalars(
            select(Jogo)
            .where(Jogo.finalizado.is_(True))
            .order_by(Jogo.data_jogo.desc())
            .limit(300)
        ).all()
    )
    if not jogos_finalizados:
        return ("sem_periodo", "Sem jogos finalizados ainda", [])

    referencia = jogos_finalizados[0]
    if referencia.tipo_fase == "grupos" and referencia.rodada is not None:
        rodada = int(referencia.rodada)
        ids = [j.id for j in jogos_finalizados if j.tipo_fase == "grupos" and int(j.rodada or 0) == rodada]
        return ("rodada_grupos", f"Rodada {rodada} (grupos)", ids)

    fase = str(referencia.fase)
    ids = [j.id for j in jogos_finalizados if j.tipo_fase == "mata_mata" and str(j.fase) == fase]
    return ("fase_mata_mata", f"Fase {fase}", ids)


def _top_por_metrica(
    db: Session, jogo_ids: list[int], expr, limit: int = 3
) -> list[InsightDestaqueInterno]:
    if not jogo_ids:
        return []
    rows = db.execute(
        select(
            Usuario.id.label("usuario_id"),
            Usuario.nome.label("nome"),
            func.coalesce(func.sum(expr), 0).label("valor"),
        )
        .select_from(PalpiteJogo)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(and_(Usuario.ativo.is_(True), PalpiteJogo.jogo_id.in_(jogo_ids)))
        .group_by(Usuario.id, Usuario.nome)
        .order_by(desc("valor"), Usuario.nome.asc())
        .limit(limit)
    ).all()
    return [
        InsightDestaqueInterno(usuario_id=int(r.usuario_id), nome=str(r.nome), valor=int(r.valor or 0))
        for r in rows
        if int(r.valor or 0) > 0
    ]


def obter_insights_periodo(db: Session, usuario_id: int) -> RankingInsightsInterno:
    periodo_tipo, periodo_label, jogo_ids = _resolver_periodo_atual(db)
    if not jogo_ids:
        return RankingInsightsInterno(
            periodo_label=periodo_label,
            periodo_tipo=periodo_tipo,
            jogos_periodo=0,
            destaques_resultado=[],
            destaques_placar_exato=[],
            destaques_marcadores_br=[],
            meu_preenchidos=0,
            meu_acertos_resultado=0,
            meu_acertos_placar_exato=0,
            meu_bonus_marcadores_br=0,
            meus_pontos_periodo=0,
        )

    destaques_resultado = _top_por_metrica(db, jogo_ids, PalpiteJogo.pontuacao_resultado)
    destaques_placar = _top_por_metrica(db, jogo_ids, PalpiteJogo.pontuacao_placar)
    destaque_marcadores = list(
        db.execute(
            select(
                Usuario.id.label("usuario_id"),
                Usuario.nome.label("nome"),
                func.count(MarcadorBrasilPalpite.id).label("valor"),
            )
            .select_from(PalpiteJogo)
            .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
            .join(MarcadorBrasilPalpite, MarcadorBrasilPalpite.palpite_jogo_id == PalpiteJogo.id)
            .where(
                and_(
                    Usuario.ativo.is_(True),
                    PalpiteJogo.jogo_id.in_(jogo_ids),
                    MarcadorBrasilPalpite.pontuacao > 0,
                )
            )
            .group_by(Usuario.id, Usuario.nome)
            .order_by(desc("valor"), Usuario.nome.asc())
            .limit(3)
        ).all()
    )
    destaques_marcadores = [
        InsightDestaqueInterno(usuario_id=int(r.usuario_id), nome=str(r.nome), valor=int(r.valor or 0))
        for r in destaque_marcadores
    ]

    meu = db.execute(
        select(
            func.count(PalpiteJogo.id).label("preenchidos"),
            func.coalesce(func.sum(PalpiteJogo.pontuacao_resultado), 0).label("acertos_resultado"),
            func.coalesce(func.sum(PalpiteJogo.pontuacao_placar), 0).label("acertos_placar"),
            func.coalesce(func.sum(PalpiteJogo.pontuacao_marcadores_brasil), 0).label("bonus_br"),
            func.coalesce(func.sum(PalpiteJogo.pontuacao_total), 0).label("pontos"),
        )
        .where(and_(PalpiteJogo.usuario_id == usuario_id, PalpiteJogo.jogo_id.in_(jogo_ids)))
    ).one()

    return RankingInsightsInterno(
        periodo_label=periodo_label,
        periodo_tipo=periodo_tipo,
        jogos_periodo=len(jogo_ids),
        destaques_resultado=destaques_resultado,
        destaques_placar_exato=destaques_placar,
        destaques_marcadores_br=destaques_marcadores,
        meu_preenchidos=int(meu.preenchidos or 0),
        meu_acertos_resultado=int(meu.acertos_resultado or 0),
        meu_acertos_placar_exato=int(meu.acertos_placar or 0),
        meu_bonus_marcadores_br=int(meu.bonus_br or 0),
        meus_pontos_periodo=int(meu.pontos or 0),
    )
