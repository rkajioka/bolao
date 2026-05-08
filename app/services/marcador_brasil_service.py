"""
Marcadores de gols do Brasil — palpite do usuário (ligado ao palpite do jogo) e resultado oficial (admin).

Após salvar resultado oficial, dispara `pontuacao_service.recalcular_todos_palpites_do_jogo`.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.jogo import Jogo
from app.models.marcador_brasil import MarcadorBrasilPalpite, MarcadorBrasilResultado
from app.models.palpite_jogo import PalpiteJogo
from app.schemas.marcador_brasil import MarcadorBrasilPalpiteItem, MarcadoresBrasilResultadoSync
from app.services import candidato_marcador_brasil_service, jogo_service, palpite_jogo_service


def _agora_utc() -> datetime:
    return datetime.now(UTC)


def _assert_jogo_editavel_marcadores_usuario(db: Session, jogo: Jogo) -> None:
    if jogo.finalizado:
        raise ValueError("O jogo está finalizado; os marcadores não podem ser alterados")
    agora = _agora_utc()
    limite = jogo_service.momento_fim_edicao_palpite(db, jogo)
    if limite.tzinfo is None:
        limite = limite.replace(tzinfo=UTC)
    if agora >= limite:
        raise ValueError(
            "Os marcadores não podem ser alterados: prazo encerrado (mesma regra dos palpites por jogo)"
        )


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
    db: Session, usuario_id: int, jogo_id: int
) -> list[MarcadorBrasilPalpite]:
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
    db: Session, usuario_id: int, jogo_id: int, marcadores: list[MarcadorBrasilPalpiteItem]
) -> list[MarcadorBrasilPalpite]:
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

    linhas: list[tuple[str, int]] = []
    for m in marcadores:
        q = int(m.quantidade_gols)
        if q <= 0:
            continue
        nome_in = m.nome_jogador.strip()
        if not nome_in:
            continue
        chave = nome_in.casefold()
        if chave not in nomes_canonicos:
            raise ValueError(
                f'Jogador "{nome_in}" não está na lista de candidatos a marcador do Brasil (ativos)'
            )
        if q > gols_brasil:
            raise ValueError(
                f"Gols do marcador ({q}) não podem ultrapassar os gols do Brasil no palpite ({gols_brasil})"
            )
        linhas.append((nomes_canonicos[chave], q))

    total_marc = sum(q for _, q in linhas)
    if total_marc > gols_brasil:
        raise ValueError(
            f"A soma dos gols dos marcadores ({total_marc}) não pode ultrapassar os gols do Brasil "
            f"no palpite ({gols_brasil})"
        )

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
    return listar_marcadores_palpite_usuario(db, usuario_id, jogo_id)


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
    obter_jogo_que_envolve_brasil(db, jogo_id)

    db.execute(delete(MarcadorBrasilResultado).where(MarcadorBrasilResultado.jogo_id == jogo_id))
    for m in body.marcadores:
        db.add(
            MarcadorBrasilResultado(
                jogo_id=jogo_id,
                nome_jogador=m.nome_jogador.strip(),
                quantidade_gols=m.quantidade_gols,
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
