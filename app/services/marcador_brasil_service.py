"""
Marcadores de gols do Brasil — palpite do usuário (ligado ao palpite do jogo) e resultado oficial (admin).

Após salvar resultado oficial, dispara `pontuacao_service.recalcular_todos_palpites_do_jogo`.
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.jogo import Jogo
from app.models.marcador_brasil import MarcadorBrasilPalpite, MarcadorBrasilResultado
from app.models.palpite_jogo import PalpiteJogo
from app.schemas.marcador_brasil import MarcadorBrasilPalpiteItem, MarcadoresBrasilResultadoSync
from app.services import candidato_marcador_brasil_service, empresa_service, jogo_service, palpite_jogo_service
from app.services.regra_negocio import assert_jogo_nao_finalizado, assert_palpite_aberto, obter_jogo_para_edicao_palpite

MARCADORES_BRASIL_EMPRESA_DESABILITADO = "Bônus de marcadores desabilitado no bolão."


class MarcadoresBrasilEmpresaDesabilitadoError(Exception):
    """Empresa sem bônus de marcadores do Brasil habilitado."""


def exigir_marcadores_brasil_habilitado_empresa(db: Session, empresa_id: int | None) -> None:
    if not empresa_service.marcadores_brasil_habilitado(db, empresa_id):
        raise MarcadoresBrasilEmpresaDesabilitadoError(MARCADORES_BRASIL_EMPRESA_DESABILITADO)


def _assert_jogo_editavel_marcadores_usuario(db: Session, jogo: Jogo) -> None:
    assert_palpite_aberto(
        db,
        jogo,
    )


def _gols_brasil_no_placar_oficial(jogo: Jogo) -> int:
    casa = jogo.pais_casa
    fora = jogo.pais_fora
    if casa is not None and str(casa.sigla).upper() == "BR":
        if jogo.placar_casa is None:
            raise ValueError("Informe o placar oficial do Brasil antes dos marcadores")
        return int(jogo.placar_casa)
    if fora is not None and str(fora.sigla).upper() == "BR":
        if jogo.placar_fora is None:
            raise ValueError("Informe o placar oficial do Brasil antes dos marcadores")
        return int(jogo.placar_fora)
    raise ValueError("Jogo não envolve o Brasil")


def _validar_e_normalizar_marcadores_palpite(
    marcadores: list[MarcadorBrasilPalpiteItem],
    gols_brasil: int,
    nomes_canonicos: dict[str, str],
) -> list[tuple[str, int]]:
    if gols_brasil <= 0:
        for m in marcadores:
            if m.nome_jogador.strip() or int(m.quantidade_gols) > 0:
                raise ValueError("Com 0 gols do Brasil no palpite, não envie marcadores")
        return []

    linhas: list[tuple[str, int]] = []
    for m in marcadores:
        q = int(m.quantidade_gols)
        nome_in = m.nome_jogador.strip()
        if not nome_in:
            if q > 0:
                raise ValueError("Informe o jogador em cada linha de marcador")
            continue
        if q != 1:
            raise ValueError(
                "Cada linha de marcador deve valer exatamente 1 gol; "
                "para repetir um jogador, adicione outra linha"
            )
        chave = nome_in.casefold()
        if chave not in nomes_canonicos:
            raise ValueError(
                f'Jogador "{nome_in}" não está na lista de candidatos a marcador do Brasil (ativos)'
            )
        linhas.append((nomes_canonicos[chave], 1))

    if len(linhas) != gols_brasil:
        raise ValueError(
            f"Informe exatamente {gols_brasil} marcador(es), um por gol do Brasil no palpite "
            f"(você enviou {len(linhas)})"
        )
    return linhas


def _gols_brasil_no_palpite(palpite: PalpiteJogo, jogo: Jogo) -> int:
    """Gols do Brasil no palpite (casa ou fora), conforme o lado do BR no jogo."""
    casa = jogo.pais_casa
    fora = jogo.pais_fora
    if casa is not None and str(casa.sigla).upper() == "BR":
        v = palpite.palpite_casa
    elif fora is not None and str(fora.sigla).upper() == "BR":
        v = palpite.palpite_fora
    else:
        raise ValueError("Jogo não envolve o Brasil")
    if v is None:
        raise ValueError("Palpite incompleto: informe o placar antes dos marcadores do Brasil")
    return int(v)


def obter_jogo_que_envolve_brasil(db: Session, jogo_id: int) -> Jogo:
    jogo = jogo_service.get_by_id(db, jogo_id)
    if jogo is None:
        raise ValueError("Jogo não encontrado")
    if not jogo_service.jogo_envolve_brasil(db, jogo):
        raise ValueError("Marcadores do Brasil só são permitidos em jogos que envolvam o Brasil")
    return jogo


def listar_marcadores_palpite_usuario(
    db: Session, usuario_id: int, jogo_id: int, *, empresa_id: int | None
) -> list[MarcadorBrasilPalpite]:
    exigir_marcadores_brasil_habilitado_empresa(db, empresa_id)
    palpite = palpite_jogo_service.get_by_usuario_jogo(db, usuario_id, jogo_id)
    if palpite is None:
        return []
    q = (
        select(MarcadorBrasilPalpite)
        .where(MarcadorBrasilPalpite.palpite_jogo_id == palpite.id)
        .order_by(MarcadorBrasilPalpite.id.asc())
    )
    return list(db.scalars(q).all())


def sincronizar_marcadores_palpite(
    db: Session,
    usuario_id: int,
    jogo_id: int,
    marcadores: list[MarcadorBrasilPalpiteItem],
    *,
    empresa_id: int | None,
) -> list[MarcadorBrasilPalpite]:
    exigir_marcadores_brasil_habilitado_empresa(db, empresa_id)
    jogo = obter_jogo_que_envolve_brasil(db, jogo_id)
    _assert_jogo_editavel_marcadores_usuario(db, jogo)

    palpite = palpite_jogo_service.get_by_usuario_jogo(db, usuario_id, jogo_id)
    if palpite is None:
        raise ValueError("É necessário salvar o palpite do jogo antes dos marcadores do Brasil")

    jogo_palpite = palpite.jogo
    if jogo_palpite is None:
        raise ValueError("Palpite sem jogo associado")
    gols_brasil = _gols_brasil_no_palpite(palpite, jogo_palpite)

    candidatos_ativos = candidato_marcador_brasil_service.listar_ativos(db)
    nomes_canonicos = {c.nome.strip().casefold(): c.nome.strip() for c in candidatos_ativos}

    linhas = _validar_e_normalizar_marcadores_palpite(marcadores, gols_brasil, nomes_canonicos)

    jogo_atual = obter_jogo_para_edicao_palpite(db, jogo_id)
    assert_palpite_aberto(db, jogo_atual)

    db.execute(delete(MarcadorBrasilPalpite).where(MarcadorBrasilPalpite.palpite_jogo_id == palpite.id))
    for nome_jogador, quantidade_gols in linhas:
        db.add(
            MarcadorBrasilPalpite(
                palpite_jogo_id=palpite.id,
                nome_jogador=nome_jogador,
                quantidade_gols=quantidade_gols,
            )
        )
    db.commit()
    return listar_marcadores_palpite_usuario(db, usuario_id, jogo_id, empresa_id=empresa_id)


def listar_marcadores_resultado_admin(db: Session, jogo_id: int) -> list[MarcadorBrasilResultado]:
    obter_jogo_que_envolve_brasil(db, jogo_id)
    q = (
        select(MarcadorBrasilResultado)
        .where(MarcadorBrasilResultado.jogo_id == jogo_id)
        .order_by(MarcadorBrasilResultado.id.asc())
    )
    return list(db.scalars(q).all())


def sincronizar_marcadores_resultado_admin(
    db: Session, jogo_id: int, body: MarcadoresBrasilResultadoSync
) -> list[MarcadorBrasilResultado]:
    jogo = obter_jogo_que_envolve_brasil(db, jogo_id)
    assert_jogo_nao_finalizado(jogo)
    gols_brasil = _gols_brasil_no_placar_oficial(jogo)

    linhas: list[tuple[str, int]] = []
    for m in body.marcadores:
        q = int(m.quantidade_gols)
        if q <= 0:
            continue
        nome = m.nome_jogador.strip()
        if not nome:
            continue
        if q > gols_brasil:
            raise ValueError(
                f"Gols do marcador ({q}) não podem ultrapassar os gols do Brasil no resultado ({gols_brasil})"
            )
        linhas.append((nome, q))

    total_marc = sum(q for _, q in linhas)
    if total_marc > gols_brasil:
        raise ValueError(
            f"A soma dos gols dos marcadores ({total_marc}) não pode ultrapassar os gols do Brasil "
            f"no resultado ({gols_brasil})"
        )

    db.execute(delete(MarcadorBrasilResultado).where(MarcadorBrasilResultado.jogo_id == jogo_id))
    for nome_jogador, quantidade_gols in linhas:
        db.add(
            MarcadorBrasilResultado(
                jogo_id=jogo_id,
                nome_jogador=nome_jogador,
                quantidade_gols=quantidade_gols,
            )
        )
    db.commit()
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_do_jogo(db, jogo_id)
    return listar_marcadores_resultado_admin(db, jogo_id)


def recalcular_marcadores_brasil_stub(db: Session, jogo_id: int) -> None:
    """Admin: força recálculo do bônus de marcadores (e demais componentes) para o jogo."""
    from app.services import pontuacao_service

    pontuacao_service.recalcular_marcadores_brasil_para_jogo(db, jogo_id)
