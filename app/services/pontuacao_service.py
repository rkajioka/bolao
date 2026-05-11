"""
Pontuação do bolão — regras §8.3, §9.6, §10.3, §11.6, §13.

Valores vêm de `configuracoes_bolao` (sem hardcode nas rotas). Se não houver linha de
configuração, os pontos configuráveis são tratados como zero.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.jogo import Jogo
from app.models.marcador_brasil import MarcadorBrasilPalpite, MarcadorBrasilResultado
from app.models.palpite_especial import PalpiteEspecial
from app.models.palpite_jogo import PalpiteJogo
from app.models.resultado_especial import ResultadoEspecial
from app.models.usuario import Usuario
from app.jogo_fases import fase_mata_mata_slug_ou_none
from app.services import configuracao_bolao_service, empresa_service, jogo_service
from app.services import pontuacao_fase_service
from app.utils.texto import normalizar_texto_palpite


def _zeros_config() -> Any:
    class _Zeros:
        pontos_placar_exato = 0
        pontos_resultado_correto = 0
        pontos_classificado_mata_mata = 0
        pontos_marcador_brasil = 0
        pontos_marcador_brasil_com_quantidade = 0
        pontos_campeao = 0
        pontos_vice_campeao = 0
        pontos_terceiro_lugar = 0
        pontos_artilheiro_pais = 0

    return _Zeros()


def _config_empresa(db: Session, empresa_id: int | None) -> ConfiguracaoBolao | Any:
    if empresa_id is None:
        return _zeros_config()
    c = configuracao_bolao_service.get_configuracao_empresa(db, empresa_id)
    if c is not None:
        return c
    return _zeros_config()


def _signo_resultado(casa: int, fora: int) -> int:
    if casa > fora:
        return 1
    if casa < fora:
        return -1
    return 0


def _outcome_igual(p_casa: int, p_fora: int, r_casa: int, r_fora: int) -> bool:
    return _signo_resultado(p_casa, p_fora) == _signo_resultado(r_casa, r_fora)


def calcular_pontuacao_jogo(
    palpite_casa: int | None,
    palpite_fora: int | None,
    resultado_casa: int,
    resultado_fora: int,
    config: ConfiguracaoBolao | Any,
) -> tuple[int, int]:
    """
    Fase de grupos: retorna (pontuacao_placar, pontuacao_resultado).
    Placar exato consome apenas `pontos_placar_exato`; caso contrário, testa acerto do
    resultado (vitória casa / empate / vitória fora) com `pontos_resultado_correto`.
    """
    if palpite_casa is None or palpite_fora is None:
        return (0, 0)
    if palpite_casa == resultado_casa and palpite_fora == resultado_fora:
        return (int(config.pontos_placar_exato), 0)
    if _outcome_igual(palpite_casa, palpite_fora, resultado_casa, resultado_fora):
        return (0, int(config.pontos_resultado_correto))
    return (0, 0)


def calcular_pontuacao_mata_mata(
    palpite_casa: int | None,
    palpite_fora: int | None,
    palpite_classificado_id: int | None,
    resultado_casa: int,
    resultado_fora: int,
    classificado_id: int | None,
    config: ConfiguracaoBolao | Any,
) -> tuple[int, int, int]:
    """
    Mata-mata: (placar, resultado, classificado).
    Classificado só pontua se `classificado_id` oficial estiver definido e bater com o palpite.
    """
    p_placar, p_res = calcular_pontuacao_jogo(
        palpite_casa, palpite_fora, resultado_casa, resultado_fora, config
    )
    p_class = 0
    if (
        classificado_id is not None
        and palpite_classificado_id is not None
        and palpite_classificado_id == classificado_id
    ):
        p_class = int(config.pontos_classificado_mata_mata)
    return (p_placar, p_res, p_class)


def calcular_pontuacao_marcadores_brasil(
    linhas_palpite: list[tuple[str, int]],
    linhas_resultado: list[tuple[str, int]],
    config: ConfiguracaoBolao | Any,
) -> tuple[int, list[int]]:
    """
    Retorna (pontuação total do bônus, pontuação por linha na mesma ordem de `linhas_palpite`).
    Agrupa linhas de palpite com o mesmo nome normalizado para somar gols palpitados.
    """
    p_hit = int(config.pontos_marcador_brasil)
    p_exact = int(config.pontos_marcador_brasil_com_quantidade)

    real: dict[str, int] = defaultdict(int)
    for nome, q in linhas_resultado:
        key = normalizar_texto_palpite(nome)
        if key:
            real[key] += int(q)

    n = len(linhas_palpite)
    per_row = [0] * n
    groups: dict[str, list[int]] = defaultdict(list)
    for i, (nome, _q) in enumerate(linhas_palpite):
        key = normalizar_texto_palpite(nome)
        if not key:
            continue
        groups[key].append(i)

    total = 0
    for key, indices in groups.items():
        if not indices:
            continue
        sum_guess = sum(linhas_palpite[i][1] for i in indices)
        real_qty = real.get(key, 0)
        group_pts = 0
        if real_qty >= 1 and sum_guess >= 1:
            group_pts += p_hit
        if real_qty > 0 and sum_guess == real_qty:
            group_pts += p_exact
        total += group_pts
        base, rem = divmod(group_pts, len(indices))
        for j, idx in enumerate(indices):
            per_row[idx] = base + (1 if j < rem else 0)

    return (total, per_row)


def calcular_pontuacao_especial(
    palpite: PalpiteEspecial,
    resultado: ResultadoEspecial,
    config: ConfiguracaoBolao | Any,
) -> tuple[int, int, int, int]:
    """Retorna (campeão, vice-campeão, terceiro lugar, país do artilheiro)."""
    if not resultado.finalizado:
        return (0, 0, 0, 0)

    p_cam = 0
    if palpite.campeao_id is not None and palpite.campeao_id == resultado.campeao_id:
        p_cam = int(config.pontos_campeao)

    p_vice = 0
    if palpite.vice_campeao_id is not None and palpite.vice_campeao_id == resultado.vice_campeao_id:
        p_vice = int(getattr(config, "pontos_vice_campeao", 0))

    p_terceiro = 0
    if palpite.terceiro_lugar_id is not None and palpite.terceiro_lugar_id == resultado.terceiro_lugar_id:
        p_terceiro = int(getattr(config, "pontos_terceiro_lugar", 0))

    p_art_pais = 0
    if palpite.artilheiro_pais_id is not None and palpite.artilheiro_pais_id == resultado.artilheiro_pais_id:
        p_art_pais = int(getattr(config, "pontos_artilheiro_pais", 0))

    return (p_cam, p_vice, p_terceiro, p_art_pais)


def _fase_key_para_jogo(jogo: Jogo) -> str | None:
    if jogo.tipo_fase == "grupos":
        if jogo.rodada in (1, 2, 3):
            return f"grupo_rodada_{jogo.rodada}"
        return None
    return fase_mata_mata_slug_ou_none(jogo.fase)


def _config_para_jogo(
    db: Session, jogo: Jogo, cfg_global: ConfiguracaoBolao | Any, empresa_id: int | None
) -> ConfiguracaoBolao | Any:
    key = _fase_key_para_jogo(jogo)
    if not key or empresa_id is None:
        return cfg_global
    fase_cfg = pontuacao_fase_service.get_por_fase_key_empresa(db, empresa_id, key)
    if fase_cfg is None:
        return cfg_global
    return fase_cfg


def _palpites_jogo_com_marcadores(
    db: Session, jogo_id: int, empresa_id: int | None = None
) -> list[PalpiteJogo]:
    stmt = (
        select(PalpiteJogo)
        .options(
            selectinload(PalpiteJogo.marcadores_brasil),
            selectinload(PalpiteJogo.usuario),
        )
        .where(PalpiteJogo.jogo_id == jogo_id)
    )
    if empresa_id is not None:
        stmt = stmt.join(Usuario, Usuario.id == PalpiteJogo.usuario_id).where(
            Usuario.empresa_id == empresa_id
        )
    return list(db.scalars(stmt).unique().all())


def _resultado_marcadores_tuples(db: Session, jogo_id: int) -> list[tuple[str, int]]:
    rows = db.scalars(
        select(MarcadorBrasilResultado)
        .where(MarcadorBrasilResultado.jogo_id == jogo_id)
        .order_by(MarcadorBrasilResultado.id.asc())
    ).all()
    return [(r.nome_jogador, r.quantidade_gols) for r in rows]


def _atualizar_um_palpite_jogo(
    db: Session, palpite: PalpiteJogo, jogo: Jogo, cfg: ConfiguracaoBolao | Any, empresa_id: int | None
) -> None:
    p_placar = p_res = p_class = p_marc = 0
    cfg_jogo = _config_para_jogo(db, jogo, cfg, empresa_id)

    if jogo.finalizado and jogo.placar_casa is not None and jogo.placar_fora is not None:
        rc, rf = jogo.placar_casa, jogo.placar_fora
        if jogo.tipo_fase == "grupos":
            p_placar, p_res = calcular_pontuacao_jogo(
                palpite.palpite_casa, palpite.palpite_fora, rc, rf, cfg_jogo
            )
        else:
            p_placar, p_res, p_class = calcular_pontuacao_mata_mata(
                palpite.palpite_casa,
                palpite.palpite_fora,
                palpite.palpite_classificado_id,
                rc,
                rf,
                jogo.classificado_id,
                cfg_jogo,
            )

    if (
        jogo.finalizado
        and jogo.placar_casa is not None
        and jogo.placar_fora is not None
        and jogo_service.jogo_envolve_brasil(db, jogo)
        and empresa_service.marcadores_brasil_habilitado(db, empresa_id)
    ):
        linhas_p = [(m.nome_jogador, m.quantidade_gols) for m in palpite.marcadores_brasil]
        linhas_r = _resultado_marcadores_tuples(db, jogo.id)
        p_marc, per_row = calcular_pontuacao_marcadores_brasil(linhas_p, linhas_r, cfg)
        marcs = list(palpite.marcadores_brasil)
        for idx in range(len(marcs)):
            marcs[idx].pontuacao = per_row[idx] if idx < len(per_row) else 0
    else:
        p_marc = 0
        for m in palpite.marcadores_brasil:
            m.pontuacao = 0

    palpite.pontuacao_placar = p_placar
    palpite.pontuacao_resultado = p_res
    palpite.pontuacao_classificado = p_class
    palpite.pontuacao_marcadores_brasil = p_marc
    palpite.pontuacao_total = p_placar + p_res + p_class + p_marc


def recalcular_todos_palpites_do_jogo(db: Session, jogo_id: int, empresa_id: int | None = None) -> None:
    """Persiste pontuação em todos os `palpites_jogos` daquele jogo (§7.4, §8.3)."""
    jogo = jogo_service.get_by_id(db, jogo_id)
    if jogo is None:
        return
    for palpite in _palpites_jogo_com_marcadores(db, jogo_id, empresa_id):
        palpite_empresa_id = palpite.usuario.empresa_id if palpite.usuario else empresa_id
        cfg = _config_empresa(db, palpite_empresa_id)
        _atualizar_um_palpite_jogo(db, palpite, jogo, cfg, palpite_empresa_id)
    db.commit()


def recalcular_marcadores_brasil_para_jogo(db: Session, jogo_id: int) -> None:
    """Recalcula apenas o componente de marcadores (e o total) para palpites daquele jogo."""
    recalcular_todos_palpites_do_jogo(db, jogo_id)


def recalcular_todos_palpites_especiais(db: Session, empresa_id: int | None = None) -> None:
    """Atualiza pontuação de todos os palpites especiais conforme `resultados_especiais` (§10.3)."""
    res = db.scalar(select(ResultadoEspecial).order_by(ResultadoEspecial.id.asc()).limit(1))
    stmt = select(PalpiteEspecial).options(selectinload(PalpiteEspecial.usuario)).order_by(PalpiteEspecial.id.asc())
    if empresa_id is not None:
        stmt = stmt.join(Usuario, Usuario.id == PalpiteEspecial.usuario_id).where(
            Usuario.empresa_id == empresa_id
        )
    palpites = list(db.scalars(stmt).unique().all())
    if res is None:
        for p in palpites:
            p.pontuacao_campeao = 0
            p.pontuacao_vice_campeao = 0
            p.pontuacao_terceiro_lugar = 0
            p.pontuacao_artilheiro_pais = 0
            p.pontuacao_total = 0
        db.commit()
        return

    for p in palpites:
        cfg = _config_empresa(db, p.usuario.empresa_id if p.usuario else empresa_id)
        c, vice, terceiro, art_pais = calcular_pontuacao_especial(p, res, cfg)
        p.pontuacao_campeao = c
        p.pontuacao_vice_campeao = vice
        p.pontuacao_terceiro_lugar = terceiro
        p.pontuacao_artilheiro_pais = art_pais
        p.pontuacao_total = c + vice + terceiro + art_pais
    db.commit()


def recalcular_pontuacao_empresa(db: Session, empresa_id: int) -> None:
    jogo_ids = list(db.scalars(select(Jogo.id)).all())
    for jogo_id in jogo_ids:
        recalcular_todos_palpites_do_jogo(db, int(jogo_id), empresa_id=empresa_id)
    recalcular_todos_palpites_especiais(db, empresa_id=empresa_id)
