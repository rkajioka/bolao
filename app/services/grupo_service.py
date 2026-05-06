"""
Tabela dos grupos da Copa (§8.4): calculada só a partir de jogos da fase de grupos
finalizados, com placar. Não persiste ranking de usuários.

Recálculo de pontuação / ranking ao finalizar jogo: Etapa 10 (`pontuacao_service`).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.jogo import Jogo
from app.models.pais import Pais


@dataclass
class EstatisticaGrupoPais:
    """Acumulados de um país na tabela de um grupo (somente jogos finalizados)."""

    pais_id: int
    nome: str
    sigla: str
    bandeira_url: str
    pontos: int = 0
    jogos: int = 0
    vitorias: int = 0
    empates: int = 0
    derrotas: int = 0
    gols_pro: int = 0
    gols_contra: int = 0

    @property
    def saldo_gols(self) -> int:
        return self.gols_pro - self.gols_contra


def listar_codigos_grupos_com_jogos(db: Session) -> list[str]:
    """Letras/códigos de grupo distintos que possuem ao menos um jogo de fase de grupos."""
    q = (
        select(Jogo.grupo)
        .where(Jogo.tipo_fase == "grupos")
        .where(Jogo.grupo.isnot(None))
        .where(Jogo.grupo != "")
        .distinct()
        .order_by(Jogo.grupo.asc())
    )
    raw = list(db.scalars(q).all())
    seen: set[str] = set()
    out: list[str] = []
    for g in raw:
        if g is None:
            continue
        cod = str(g).strip().upper()
        if cod and cod not in seen:
            seen.add(cod)
            out.append(cod)
    return out


def _listar_jogos_do_grupo(db: Session, grupo_normalizado: str) -> list[Jogo]:
    return list(
        db.scalars(
            select(Jogo)
            .options(joinedload(Jogo.pais_casa), joinedload(Jogo.pais_fora))
            .where(Jogo.tipo_fase == "grupos")
            .where(Jogo.grupo == grupo_normalizado)
            .order_by(Jogo.data_jogo.asc(), Jogo.id.asc())
        ).unique()
        .all()
    )


def _garantir_stats(stats: dict[int, EstatisticaGrupoPais], pais: Pais) -> EstatisticaGrupoPais:
    if pais.id not in stats:
        stats[pais.id] = EstatisticaGrupoPais(
            pais_id=pais.id,
            nome=pais.nome,
            sigla=pais.sigla,
            bandeira_url=pais.bandeira_url,
        )
    return stats[pais.id]


def _acumular_jogo_finalizado(stats: dict[int, EstatisticaGrupoPais], jogo: Jogo) -> None:
    if not jogo.finalizado:
        return
    pc, pf = jogo.placar_casa, jogo.placar_fora
    if pc is None or pf is None:
        return

    casa = jogo.pais_casa
    fora = jogo.pais_fora
    sc = _garantir_stats(stats, casa)
    sf = _garantir_stats(stats, fora)

    sc.jogos += 1
    sf.jogos += 1
    sc.gols_pro += pc
    sc.gols_contra += pf
    sf.gols_pro += pf
    sf.gols_contra += pc

    if pc > pf:
        sc.pontos += 3
        sc.vitorias += 1
        sf.derrotas += 1
    elif pc < pf:
        sf.pontos += 3
        sf.vitorias += 1
        sc.derrotas += 1
    else:
        sc.pontos += 1
        sf.pontos += 1
        sc.empates += 1
        sf.empates += 1


def calcular_tabela_grupo(db: Session, grupo: str) -> list[EstatisticaGrupoPais]:
    """
    Monta a tabela do grupo conforme §8.4 (apenas jogos finalizados com placar).
    Ordenação: pontos, saldo, gols pró, nome (alfabético).
    Levanta países a partir dos jogos cadastrados no grupo.
    """
    cod = grupo.strip().upper()
    if not cod:
        raise ValueError("Grupo inválido")

    jogos = _listar_jogos_do_grupo(db, cod)
    if not jogos:
        raise ValueError("Grupo não encontrado")

    stats: dict[int, EstatisticaGrupoPais] = {}
    for j in jogos:
        _garantir_stats(stats, j.pais_casa)
        _garantir_stats(stats, j.pais_fora)

    for j in jogos:
        _acumular_jogo_finalizado(stats, j)

    linhas = list(stats.values())
    linhas.sort(
        key=lambda s: (
            -s.pontos,
            -s.saldo_gols,
            -s.gols_pro,
            s.nome.casefold(),
        )
    )
    return linhas


def normalizar_codigo_grupo(grupo: str) -> str:
    cod = grupo.strip().upper()
    if not cod:
        raise ValueError("Grupo inválido")
    return cod
