"""
Insights do ranking por bloco do torneio (rodada/fase) e por empresa.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.orm import Session

from app.jogo_fases import fase_mata_mata_slug_ou_none
from app.models.jogo import Jogo
from app.models.palpite_jogo import PalpiteJogo
from app.models.usuario import Usuario
from app.services.pontuacao_fase_service import DEFAULTS
from app.services.ranking_service import condicoes_usuario_ranking

PONTOS_BLOCO_EXPR = (
    PalpiteJogo.pontuacao_placar
    + PalpiteJogo.pontuacao_resultado
    + PalpiteJogo.pontuacao_classificado
)

PALPITE_PREENCHIDO = and_(
    PalpiteJogo.palpite_casa.is_not(None),
    PalpiteJogo.palpite_fora.is_not(None),
)

ACERTO_PLACAR_EXATO = PalpiteJogo.pontuacao_placar > 0
ACERTO_RESULTADO = or_(PalpiteJogo.pontuacao_resultado > 0, ACERTO_PLACAR_EXATO)
ACERTO_CLASSIFICADO = PalpiteJogo.pontuacao_classificado > 0
CONTAGEM_ACERTO_PLACAR_EXATO = case((ACERTO_PLACAR_EXATO, 1), else_=0)
CONTAGEM_ACERTO_RESULTADO = case((ACERTO_RESULTADO, 1), else_=0)


@dataclass(frozen=True)
class BlocoTorneio:
    chave: str
    ordem: int
    label: str


@dataclass(frozen=True)
class InsightDestaqueInterno:
    usuario_id: int
    nome: str
    valor: int


@dataclass(frozen=True)
class InsightMetricaEmpresaInterna:
    chave: str
    label: str
    valor: int
    total: int | None = None


@dataclass(frozen=True)
class DestaquesUsuariosInterno:
    pontos_bloco: list[InsightDestaqueInterno]
    placar_exato: list[InsightDestaqueInterno]
    resultado: list[InsightDestaqueInterno]
    classificado: list[InsightDestaqueInterno]


@dataclass(frozen=True)
class RankingInsightsInterno:
    periodo_chave: str | None
    periodo_label: str
    periodo_tipo: str
    periodo_status: str
    periodo_em_andamento_label: str | None
    jogos_periodo: int
    participantes_empresa: int
    participantes_com_palpite_no_bloco: int
    metricas_empresa: list[InsightMetricaEmpresaInterna]
    destaques_usuarios: DestaquesUsuariosInterno
    meu_preenchidos: int
    meu_acertos_resultado: int
    meu_acertos_placar_exato: int
    meus_acertos_classificado: int
    meus_pontos_periodo: int
    minha_posicao_periodo: int | None


BLOCOS_TORNEIO: tuple[BlocoTorneio, ...] = tuple(
    BlocoTorneio(
        chave=str(item["fase_key"]),
        ordem=int(item["ordem"]),
        label=str(item["label"]),
    )
    for item in sorted(DEFAULTS, key=lambda row: int(row["ordem"]))
)


def _chave_bloco_jogo(jogo: Jogo) -> str | None:
    if jogo.tipo_fase == "grupos" and jogo.rodada is not None:
        return f"grupo_rodada_{int(jogo.rodada)}"
    if jogo.tipo_fase == "mata_mata":
        return fase_mata_mata_slug_ou_none(jogo.fase)
    return None


def _bloco_esta_fechado(jogos: list[Jogo]) -> bool:
    return bool(jogos) and all(j.finalizado for j in jogos)


def _periodo_tipo_de_chave(chave: str | None) -> str:
    if chave is None:
        return "sem_periodo"
    if chave.startswith("grupo_rodada_"):
        return "rodada_grupos"
    return "fase_mata_mata"


def _is_mata_mata_chave(chave: str | None) -> bool:
    return chave is not None and not chave.startswith("grupo_rodada_")


def _agrupar_jogos_por_bloco(db: Session) -> dict[str, list[Jogo]]:
    jogos = list(db.scalars(select(Jogo).order_by(Jogo.id.asc())).all())
    grupos: dict[str, list[Jogo]] = {b.chave: [] for b in BLOCOS_TORNEIO}
    for jogo in jogos:
        chave = _chave_bloco_jogo(jogo)
        if chave is None or chave not in grupos:
            continue
        grupos[chave].append(jogo)
    return grupos


def resolver_periodo_insights(
    db: Session,
) -> tuple[str | None, str, str, str | None, list[int], bool]:
    grupos = _agrupar_jogos_por_bloco(db)
    ultimo_fechado: BlocoTorneio | None = None
    corrente_aberto: BlocoTorneio | None = None

    for bloco in BLOCOS_TORNEIO:
        jogos = grupos[bloco.chave]
        if not jogos:
            continue
        if _bloco_esta_fechado(jogos):
            ultimo_fechado = bloco
            continue
        if corrente_aberto is None:
            corrente_aberto = bloco

    if ultimo_fechado is None:
        return (
            None,
            "Aguardando a primeira rodada ou fase do torneio",
            "aguardando_primeiro_bloco",
            None,
            [],
            False,
        )

    jogo_ids = [j.id for j in grupos[ultimo_fechado.chave]]
    if corrente_aberto is not None and corrente_aberto.ordem > ultimo_fechado.ordem:
        return (
            ultimo_fechado.chave,
            ultimo_fechado.label,
            "bloco_em_andamento",
            corrente_aberto.label,
            jogo_ids,
            _is_mata_mata_chave(ultimo_fechado.chave),
        )

    return (
        ultimo_fechado.chave,
        ultimo_fechado.label,
        "disponivel",
        None,
        jogo_ids,
        _is_mata_mata_chave(ultimo_fechado.chave),
    )


def _condicoes_tenant(empresa_id: int | None) -> list:
    return condicoes_usuario_ranking(empresa_id)


def _contar_participantes_empresa(db: Session, empresa_id: int | None) -> int:
    stmt = select(func.count(Usuario.id)).where(and_(*_condicoes_tenant(empresa_id)))
    return int(db.scalar(stmt) or 0)


def _top_por_metrica(
    db: Session,
    jogo_ids: list[int],
    expr,
    empresa_id: int | None,
    limit: int = 3,
) -> list[InsightDestaqueInterno]:
    if not jogo_ids:
        return []
    condicoes = [PalpiteJogo.jogo_id.in_(jogo_ids), *_condicoes_tenant(empresa_id)]
    rows = db.execute(
        select(
            Usuario.id.label("usuario_id"),
            Usuario.nome.label("nome"),
            func.coalesce(func.sum(expr), 0).label("valor"),
        )
        .select_from(PalpiteJogo)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(and_(*condicoes))
        .group_by(Usuario.id, Usuario.nome)
        .order_by(desc("valor"), Usuario.nome.asc())
        .limit(limit)
    ).all()
    return [
        InsightDestaqueInterno(usuario_id=int(r.usuario_id), nome=str(r.nome), valor=int(r.valor or 0))
        for r in rows
        if int(r.valor or 0) > 0
    ]


def _metricas_empresa(
    db: Session,
    jogo_ids: list[int],
    empresa_id: int | None,
    participantes_empresa: int,
    bloco_mata_mata: bool,
) -> tuple[list[InsightMetricaEmpresaInterna], int]:
    if not jogo_ids:
        return [], 0

    condicoes = [PalpiteJogo.jogo_id.in_(jogo_ids), *_condicoes_tenant(empresa_id)]
    row = db.execute(
        select(
            func.count(func.distinct(case((PALPITE_PREENCHIDO, PalpiteJogo.usuario_id)))).label(
                "participantes_com_palpite"
            ),
            func.count(
                func.distinct(
                    case((ACERTO_PLACAR_EXATO, PalpiteJogo.usuario_id), else_=None)
                )
            ).label("pessoas_placar_exato"),
            func.count(
                func.distinct(
                    case((ACERTO_RESULTADO, PalpiteJogo.usuario_id), else_=None)
                )
            ).label("pessoas_resultado"),
            func.count(
                func.distinct(
                    case((ACERTO_CLASSIFICADO, PalpiteJogo.usuario_id), else_=None)
                )
            ).label("pessoas_classificado"),
            func.coalesce(func.sum(CONTAGEM_ACERTO_PLACAR_EXATO), 0).label("total_placares_exatos"),
            func.coalesce(func.sum(CONTAGEM_ACERTO_RESULTADO), 0).label("total_acertos_resultado"),
            func.coalesce(func.sum(case((PALPITE_PREENCHIDO, 1), else_=0)), 0).label("palpites_preenchidos"),
        )
        .select_from(PalpiteJogo)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(and_(*condicoes))
    ).one()

    participantes_com_palpite = int(row.participantes_com_palpite or 0)
    palpites_preenchidos = int(row.palpites_preenchidos or 0)
    denominador_cobertura = participantes_empresa * len(jogo_ids)
    cobertura_pct = (
        int(round((palpites_preenchidos / denominador_cobertura) * 100))
        if denominador_cobertura > 0
        else 0
    )

    pontos_por_usuario = (
        select(func.coalesce(func.sum(PONTOS_BLOCO_EXPR), 0).label("pontos"))
        .select_from(PalpiteJogo)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(and_(*condicoes, PALPITE_PREENCHIDO))
        .group_by(PalpiteJogo.usuario_id)
        .subquery()
    )
    media_pontos = int(round(float(db.scalar(select(func.avg(pontos_por_usuario.c.pontos))) or 0)))

    metricas = [
        InsightMetricaEmpresaInterna(
            chave="participantes_com_palpite",
            label="Participantes com palpite na rodada/fase",
            valor=participantes_com_palpite,
            total=participantes_empresa,
        ),
        InsightMetricaEmpresaInterna(
            chave="pessoas_placar_exato",
            label="Pessoas com ao menos 1 placar exato",
            valor=int(row.pessoas_placar_exato or 0),
            total=participantes_empresa,
        ),
        InsightMetricaEmpresaInterna(
            chave="pessoas_resultado",
            label="Pessoas com ao menos 1 resultado correto",
            valor=int(row.pessoas_resultado or 0),
            total=participantes_empresa,
        ),
        InsightMetricaEmpresaInterna(
            chave="total_placares_exatos",
            label="Total de placares exatos na rodada/fase",
            valor=int(row.total_placares_exatos or 0),
        ),
        InsightMetricaEmpresaInterna(
            chave="total_acertos_resultado",
            label="Total de acertos de resultado na rodada/fase",
            valor=int(row.total_acertos_resultado or 0),
        ),
        InsightMetricaEmpresaInterna(
            chave="media_pontos_quem_palpitou",
            label="Média de pontos (quem palpitou)",
            valor=media_pontos,
        ),
        InsightMetricaEmpresaInterna(
            chave="cobertura_palpites_pct",
            label="Cobertura de palpites na rodada/fase",
            valor=cobertura_pct,
            total=100,
        ),
    ]
    if bloco_mata_mata:
        metricas.insert(
            3,
            InsightMetricaEmpresaInterna(
                chave="pessoas_classificado",
                label="Pessoas com ao menos 1 classificado correto",
                valor=int(row.pessoas_classificado or 0),
                total=participantes_empresa,
            ),
        )

    return metricas, participantes_com_palpite


def _minha_posicao_periodo(
    db: Session,
    jogo_ids: list[int],
    empresa_id: int | None,
    usuario_id: int,
) -> int | None:
    if not jogo_ids:
        return None
    condicoes = [PalpiteJogo.jogo_id.in_(jogo_ids), PALPITE_PREENCHIDO, *_condicoes_tenant(empresa_id)]
    rows = db.execute(
        select(
            Usuario.id.label("usuario_id"),
            func.coalesce(func.sum(PONTOS_BLOCO_EXPR), 0).label("pontos"),
        )
        .select_from(PalpiteJogo)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(and_(*condicoes))
        .group_by(Usuario.id)
        .order_by(desc("pontos"), Usuario.nome.asc())
    ).all()
    if not rows:
        return None
    for idx, row in enumerate(rows, start=1):
        if int(row.usuario_id) == usuario_id:
            return idx
    return None


def _insights_vazios(
    periodo_chave: str | None,
    periodo_label: str,
    periodo_status: str,
    periodo_em_andamento_label: str | None,
    participantes_empresa: int,
) -> RankingInsightsInterno:
    return RankingInsightsInterno(
        periodo_chave=periodo_chave,
        periodo_label=periodo_label,
        periodo_tipo=_periodo_tipo_de_chave(periodo_chave),
        periodo_status=periodo_status,
        periodo_em_andamento_label=periodo_em_andamento_label,
        jogos_periodo=0,
        participantes_empresa=participantes_empresa,
        participantes_com_palpite_no_bloco=0,
        metricas_empresa=[],
        destaques_usuarios=DestaquesUsuariosInterno([], [], [], []),
        meu_preenchidos=0,
        meu_acertos_resultado=0,
        meu_acertos_placar_exato=0,
        meus_acertos_classificado=0,
        meus_pontos_periodo=0,
        minha_posicao_periodo=None,
    )


def obter_insights_periodo(
    db: Session, usuario_id: int, empresa_id: int | None = None
) -> RankingInsightsInterno:
    (
        periodo_chave,
        periodo_label,
        periodo_status,
        periodo_em_andamento_label,
        jogo_ids,
        bloco_mata_mata,
    ) = resolver_periodo_insights(db)
    participantes_empresa = _contar_participantes_empresa(db, empresa_id)

    if not jogo_ids:
        return _insights_vazios(
            periodo_chave,
            periodo_label,
            periodo_status,
            periodo_em_andamento_label,
            participantes_empresa,
        )

    metricas_empresa, participantes_com_palpite = _metricas_empresa(
        db, jogo_ids, empresa_id, participantes_empresa, bloco_mata_mata
    )
    destaques = DestaquesUsuariosInterno(
        pontos_bloco=_top_por_metrica(db, jogo_ids, PONTOS_BLOCO_EXPR, empresa_id),
        placar_exato=_top_por_metrica(db, jogo_ids, CONTAGEM_ACERTO_PLACAR_EXATO, empresa_id),
        resultado=_top_por_metrica(db, jogo_ids, CONTAGEM_ACERTO_RESULTADO, empresa_id),
        classificado=_top_por_metrica(db, jogo_ids, case((ACERTO_CLASSIFICADO, 1), else_=0), empresa_id)
        if bloco_mata_mata
        else [],
    )

    meu = db.execute(
        select(
            func.coalesce(func.sum(case((PALPITE_PREENCHIDO, 1), else_=0)), 0).label("preenchidos"),
            func.coalesce(func.sum(CONTAGEM_ACERTO_RESULTADO), 0).label("acertos_resultado"),
            func.coalesce(func.sum(CONTAGEM_ACERTO_PLACAR_EXATO), 0).label("acertos_placar"),
            func.coalesce(
                func.sum(case((ACERTO_CLASSIFICADO, 1), else_=0)),
                0,
            ).label("acertos_classificado"),
            func.coalesce(func.sum(PONTOS_BLOCO_EXPR), 0).label("pontos"),
        ).where(and_(PalpiteJogo.usuario_id == usuario_id, PalpiteJogo.jogo_id.in_(jogo_ids)))
    ).one()

    return RankingInsightsInterno(
        periodo_chave=periodo_chave,
        periodo_label=periodo_label,
        periodo_tipo=_periodo_tipo_de_chave(periodo_chave),
        periodo_status=periodo_status,
        periodo_em_andamento_label=periodo_em_andamento_label,
        jogos_periodo=len(jogo_ids),
        participantes_empresa=participantes_empresa,
        participantes_com_palpite_no_bloco=participantes_com_palpite,
        metricas_empresa=metricas_empresa,
        destaques_usuarios=destaques,
        meu_preenchidos=int(meu.preenchidos or 0),
        meu_acertos_resultado=int(meu.acertos_resultado or 0),
        meu_acertos_placar_exato=int(meu.acertos_placar or 0),
        meus_acertos_classificado=int(meu.acertos_classificado or 0),
        meus_pontos_periodo=int(meu.pontos or 0),
        minha_posicao_periodo=_minha_posicao_periodo(db, jogo_ids, empresa_id, usuario_id),
    )
