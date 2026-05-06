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
from app.schemas.marcador_brasil import MarcadorBrasilPalpiteItem, MarcadoresBrasilResultadoSync
from app.services import jogo_service, palpite_jogo_service


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

    db.execute(delete(MarcadorBrasilPalpite).where(MarcadorBrasilPalpite.palpite_jogo_id == palpite.id))
    for m in marcadores:
        db.add(
            MarcadorBrasilPalpite(
                palpite_jogo_id=palpite.id,
                nome_jogador=m.nome_jogador.strip(),
                quantidade_gols=m.quantidade_gols,
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
