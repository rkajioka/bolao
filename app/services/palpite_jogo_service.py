"""
Palpites por jogo — criação, edição, bloqueio por horário do jogo e por finalização.

Pontuação persistida por `pontuacao_service` ao finalizar/alterar resultado do jogo.
Marcadores Brasil: Etapa 8.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.jogo import Jogo
from app.models.palpite_jogo import PalpiteJogo
from app.schemas.palpite_jogo import PalpiteJogoCreate, PalpiteJogoUpdate
from app.services import jogo_service, pais_service


def _agora_utc() -> datetime:
    return datetime.now(UTC)


def _palpite_loaders():
    return (
        joinedload(PalpiteJogo.jogo).joinedload(Jogo.pais_casa),
        joinedload(PalpiteJogo.jogo).joinedload(Jogo.pais_fora),
        joinedload(PalpiteJogo.jogo).joinedload(Jogo.classificado),
        joinedload(PalpiteJogo.palpite_classificado),
    )


def _assert_palpite_aberto(jogo: Jogo) -> None:
    if jogo.finalizado:
        raise ValueError("O jogo está finalizado; o palpite não pode ser alterado")
    agora = _agora_utc()
    inicio = jogo.data_jogo
    if inicio.tzinfo is None:
        inicio = inicio.replace(tzinfo=UTC)
    if agora >= inicio:
        raise ValueError("O palpite não pode ser alterado após o início do jogo")


def _assert_classificado_no_jogo(jogo: Jogo, classificado_id: int) -> None:
    if classificado_id not in (jogo.pais_casa_id, jogo.pais_fora_id):
        raise ValueError("O classificado deve ser o país da casa ou o país de fora deste jogo")


def _classificado_efetivo(db: Session, jogo: Jogo, classificado_id: int | None) -> int | None:
    if jogo.tipo_fase == "grupos":
        return None
    if classificado_id is None:
        raise ValueError("Em jogos de mata-mata é obrigatório informar quem se classifica")
    if pais_service.get_by_id(db, classificado_id) is None:
        raise ValueError("País classificado não encontrado")
    _assert_classificado_no_jogo(jogo, classificado_id)
    return classificado_id


def get_by_id_for_usuario(db: Session, palpite_id: int, usuario_id: int) -> PalpiteJogo | None:
    return db.scalar(
        select(PalpiteJogo)
        .options(*_palpite_loaders())
        .where(PalpiteJogo.id == palpite_id, PalpiteJogo.usuario_id == usuario_id)
    )


def get_by_usuario_jogo(db: Session, usuario_id: int, jogo_id: int) -> PalpiteJogo | None:
    return db.scalar(
        select(PalpiteJogo)
        .options(*_palpite_loaders())
        .where(PalpiteJogo.usuario_id == usuario_id, PalpiteJogo.jogo_id == jogo_id)
    )


def list_me(db: Session, usuario_id: int) -> list[PalpiteJogo]:
    q = (
        select(PalpiteJogo)
        .options(*_palpite_loaders())
        .where(PalpiteJogo.usuario_id == usuario_id)
        .join(Jogo, PalpiteJogo.jogo_id == Jogo.id)
        .order_by(Jogo.data_jogo.asc(), PalpiteJogo.id.asc())
    )
    return list(db.scalars(q).unique().all())  # unique: join + loaders


def create_palpite(db: Session, usuario_id: int, data: PalpiteJogoCreate) -> PalpiteJogo:
    jogo = jogo_service.get_by_id(db, data.jogo_id)
    if jogo is None:
        raise ValueError("Jogo não encontrado")

    if get_by_usuario_jogo(db, usuario_id, data.jogo_id) is not None:
        raise ValueError("Você já possui palpite neste jogo; use PUT para alterar")

    _assert_palpite_aberto(jogo)

    classificado = _classificado_efetivo(db, jogo, data.palpite_classificado_id)

    p = PalpiteJogo(
        usuario_id=usuario_id,
        jogo_id=data.jogo_id,
        palpite_casa=data.palpite_casa,
        palpite_fora=data.palpite_fora,
        palpite_classificado_id=classificado,
    )
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(p)
    return get_by_id_for_usuario(db, p.id, usuario_id)  # type: ignore[return-value]


def update_palpite(db: Session, usuario_id: int, palpite_id: int, data: PalpiteJogoUpdate) -> PalpiteJogo:
    p = get_by_id_for_usuario(db, palpite_id, usuario_id)
    if p is None:
        raise ValueError("Palpite não encontrado")

    jogo = p.jogo or jogo_service.get_by_id(db, p.jogo_id)
    if jogo is None:
        raise ValueError("Jogo não encontrado")

    _assert_palpite_aberto(jogo)

    casa = data.palpite_casa if data.palpite_casa is not None else p.palpite_casa
    fora = data.palpite_fora if data.palpite_fora is not None else p.palpite_fora
    cls = (
        data.palpite_classificado_id
        if data.palpite_classificado_id is not None
        else p.palpite_classificado_id
    )

    if casa is None or fora is None:
        raise ValueError("Informe palpite da casa e palpite de fora")

    classificado = _classificado_efetivo(db, jogo, cls)

    p.palpite_casa = casa
    p.palpite_fora = fora
    p.palpite_classificado_id = classificado

    db.commit()
    db.refresh(p)
    return get_by_id_for_usuario(db, p.id, usuario_id)  # type: ignore[return-value]
