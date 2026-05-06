"""
Ranking geral — agregação em tempo real (§12, §24). Não persiste tabela de ranking no MVP.

Componentes: palpites de jogos (sem bônus Brasil) + bônus marcadores Brasil + palpites especiais.
Ordenação: maior total; desempate não definido no MD → nome (ordem alfabética).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.palpite_especial import PalpiteEspecial
from app.models.palpite_jogo import PalpiteJogo
from app.models.usuario import Usuario


@dataclass(frozen=True)
class LinhaRankingInterna:
    usuario_id: int
    nome: str
    funcao: str | None
    imagem_perfil: str | None
    pontos_jogos: int
    pontos_especiais: int
    bonus_brasil: int
    pontos_totais: int


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
            pontos_jogos=int(r.pontos_jogos),
            pontos_especiais=int(r.pontos_especiais),
            bonus_brasil=int(r.bonus_brasil),
            pontos_totais=int(r.pontos_totais),
        )
        for r in rows
    ]
