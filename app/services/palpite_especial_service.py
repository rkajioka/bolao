"""
Palpites especiais do torneio — um registro por usuário, bloqueio pela primeira rodada / config.

Pontuação: `pontuacao_service` (recálculo manual PATCH /palpites-especiais/recalcular ou ao salvar resultado oficial).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.palpite_especial import PalpiteEspecial
from app.schemas.palpite_especial import (
    PalpiteEspecialAdminRead,
    PalpiteEspecialCreate,
    PalpiteEspecialRead,
    PalpiteEspecialUpdate,
)
from app.services import configuracao_bolao_service, pais_service


def _loaders():
    return joinedload(PalpiteEspecial.campeao), joinedload(PalpiteEspecial.usuario)


def _assert_nao_bloqueado(db: Session) -> None:
    if configuracao_bolao_service.palpites_especiais_esta_bloqueado(db):
        raise ValueError("Palpites especiais bloqueados após o início da primeira rodada")


def _validar_campeao(db: Session, campeao_id: int | None) -> None:
    if campeao_id is None:
        return
    if pais_service.get_by_id(db, campeao_id) is None:
        raise ValueError("País campeão não encontrado")


def to_read(db: Session, p: PalpiteEspecial) -> PalpiteEspecialRead:
    r = PalpiteEspecialRead.model_validate(p)
    efetivo = p.bloqueado or configuracao_bolao_service.palpites_especiais_esta_bloqueado(db)
    return r.model_copy(update={"bloqueado": efetivo})


def to_admin_read(db: Session, p: PalpiteEspecial) -> PalpiteEspecialAdminRead:
    r = PalpiteEspecialAdminRead.model_validate(p)
    efetivo = p.bloqueado or configuracao_bolao_service.palpites_especiais_esta_bloqueado(db)
    return r.model_copy(update={"bloqueado": efetivo})


def get_por_usuario(db: Session, usuario_id: int) -> PalpiteEspecial | None:
    return db.scalar(
        select(PalpiteEspecial)
        .options(*_loaders())
        .where(PalpiteEspecial.usuario_id == usuario_id)
    )


def listar_todos_admin(db: Session) -> list[PalpiteEspecial]:
    q = (
        select(PalpiteEspecial)
        .options(*_loaders())
        .order_by(PalpiteEspecial.id.asc())
    )
    return list(db.scalars(q).unique().all())


def create_palpite(db: Session, usuario_id: int, data: PalpiteEspecialCreate) -> PalpiteEspecial:
    if get_por_usuario(db, usuario_id) is not None:
        raise ValueError("Palpite especial já existe; use PUT /palpites-especiais/me para alterar")

    _assert_nao_bloqueado(db)
    _validar_campeao(db, data.campeao_id)

    p = PalpiteEspecial(
        usuario_id=usuario_id,
        campeao_id=data.campeao_id,
        melhor_jogador=data.melhor_jogador.strip() if data.melhor_jogador and data.melhor_jogador.strip() else None,
        artilheiro=data.artilheiro.strip() if data.artilheiro and data.artilheiro.strip() else None,
        melhor_goleiro=data.melhor_goleiro.strip() if data.melhor_goleiro and data.melhor_goleiro.strip() else None,
        bloqueado=False,
    )
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(p)
    row = get_por_usuario(db, usuario_id)
    assert row is not None
    return row


def update_palpite_me(db: Session, usuario_id: int, data: PalpiteEspecialUpdate) -> PalpiteEspecial:
    p = get_por_usuario(db, usuario_id)
    if p is None:
        raise ValueError("Palpite especial não encontrado; use POST para criar")

    _assert_nao_bloqueado(db)

    raw = data.model_dump(exclude_unset=True)
    if "campeao_id" in raw:
        _validar_campeao(db, raw["campeao_id"])
        p.campeao_id = raw["campeao_id"]
    if "melhor_jogador" in raw:
        v = raw["melhor_jogador"]
        p.melhor_jogador = v.strip() if v and str(v).strip() else None
    if "artilheiro" in raw:
        v = raw["artilheiro"]
        p.artilheiro = v.strip() if v and str(v).strip() else None
    if "melhor_goleiro" in raw:
        v = raw["melhor_goleiro"]
        p.melhor_goleiro = v.strip() if v and str(v).strip() else None

    db.commit()
    db.refresh(p)
    return p


def recalcular_palpites_especiais_stub(db: Session) -> None:
    """Recalcula pontuação de todos os palpites especiais (§10.3)."""
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_especiais(db)
