"""
Palpites especiais do torneio — um registro por usuário, bloqueio pela primeira rodada / config.

Pontuação: `pontuacao_service` (recálculo manual PATCH /palpites-especiais/recalcular ou ao salvar resultado oficial).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.palpite_especial import PalpiteEspecial
from app.schemas.especiais_common import validar_podio_sem_pais_repetido
from app.schemas.palpite_especial import (
    PalpiteEspecialAdminRead,
    PalpiteEspecialCreate,
    PalpiteEspecialRead,
    PalpiteEspecialUpdate,
)
from app.services import configuracao_bolao_service, pais_service


def _loaders():
    return (
        joinedload(PalpiteEspecial.campeao),
        joinedload(PalpiteEspecial.vice_campeao),
        joinedload(PalpiteEspecial.terceiro_lugar),
        joinedload(PalpiteEspecial.artilheiro_pais),
        joinedload(PalpiteEspecial.usuario),
    )


def _assert_nao_bloqueado(db: Session, empresa_id: int | None) -> None:
    if empresa_id is None:
        raise ValueError("Participação requer vínculo com uma empresa")
    if configuracao_bolao_service.palpites_especiais_esta_bloqueado(db, empresa_id):
        raise ValueError("Palpites especiais bloqueados após o início da primeira rodada")


def _assert_escrita_permitida(db: Session, empresa_id: int | None, palpite: PalpiteEspecial | None) -> None:
    _assert_nao_bloqueado(db, empresa_id)
    if palpite is not None and palpite.bloqueado:
        raise ValueError("Palpites especiais bloqueados para este usuário")


def _validar_campeao(db: Session, campeao_id: int | None) -> None:
    if campeao_id is None:
        return
    if pais_service.get_by_id(db, campeao_id) is None:
        raise ValueError("País campeão não encontrado")


def _validar_podio_palpite(p: PalpiteEspecial) -> None:
    validar_podio_sem_pais_repetido(
        campeao_id=p.campeao_id,
        vice_campeao_id=p.vice_campeao_id,
        terceiro_lugar_id=p.terceiro_lugar_id,
    )


def _validar_pais_generico(db: Session, pais_id: int | None, label: str) -> None:
    if pais_id is None:
        return
    if pais_service.get_by_id(db, pais_id) is None:
        raise ValueError(f"País de {label} não encontrado")


def _empresa_id_palpite(p: PalpiteEspecial) -> int | None:
    if p.usuario is not None:
        return p.usuario.empresa_id
    return None


def to_read(db: Session, p: PalpiteEspecial) -> PalpiteEspecialRead:
    r = PalpiteEspecialRead.model_validate(p)
    empresa_id = _empresa_id_palpite(p)
    efetivo = p.bloqueado or (
        configuracao_bolao_service.palpites_especiais_esta_bloqueado(db, empresa_id)
        if empresa_id is not None
        else False
    )
    return r.model_copy(update={"bloqueado": efetivo})


def to_admin_read(db: Session, p: PalpiteEspecial) -> PalpiteEspecialAdminRead:
    r = PalpiteEspecialAdminRead.model_validate(p)
    empresa_id = _empresa_id_palpite(p)
    efetivo = p.bloqueado or (
        configuracao_bolao_service.palpites_especiais_esta_bloqueado(db, empresa_id)
        if empresa_id is not None
        else False
    )
    return r.model_copy(update={"bloqueado": efetivo})


def get_por_usuario(db: Session, usuario_id: int) -> PalpiteEspecial | None:
    return db.scalar(
        select(PalpiteEspecial)
        .options(*_loaders())
        .where(PalpiteEspecial.usuario_id == usuario_id)
    )


def listar_todos_admin(db: Session) -> list[PalpiteEspecial]:
    """Lista global de palpites especiais para o owner (cross-tenant por design)."""
    q = (
        select(PalpiteEspecial)
        .options(*_loaders())
        .order_by(PalpiteEspecial.id.asc())
    )
    return list(db.scalars(q).unique().all())


def create_palpite(db: Session, usuario_id: int, data: PalpiteEspecialCreate, empresa_id: int | None) -> PalpiteEspecial:
    if get_por_usuario(db, usuario_id) is not None:
        raise ValueError("Palpite especial já existe; use PUT /palpites-especiais/me para alterar")

    _assert_escrita_permitida(db, empresa_id, None)
    _validar_campeao(db, data.campeao_id)
    _validar_pais_generico(db, data.vice_campeao_id, "vice-campeão")
    _validar_pais_generico(db, data.terceiro_lugar_id, "terceiro lugar")
    _validar_pais_generico(db, data.artilheiro_pais_id, "país do artilheiro")

    p = PalpiteEspecial(
        usuario_id=usuario_id,
        campeao_id=data.campeao_id,
        vice_campeao_id=data.vice_campeao_id,
        terceiro_lugar_id=data.terceiro_lugar_id,
        artilheiro_pais_id=data.artilheiro_pais_id,
        bloqueado=False,
    )
    _validar_podio_palpite(p)
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


def update_palpite_me(db: Session, usuario_id: int, data: PalpiteEspecialUpdate, empresa_id: int | None) -> PalpiteEspecial:
    p = get_por_usuario(db, usuario_id)
    if p is None:
        raise ValueError("Palpite especial não encontrado; use POST para criar")

    _assert_escrita_permitida(db, empresa_id, p)

    raw = data.model_dump(exclude_unset=True)
    if "campeao_id" in raw:
        _validar_campeao(db, raw["campeao_id"])
        p.campeao_id = raw["campeao_id"]
    if "vice_campeao_id" in raw:
        _validar_pais_generico(db, raw["vice_campeao_id"], "vice-campeão")
        p.vice_campeao_id = raw["vice_campeao_id"]
    if "terceiro_lugar_id" in raw:
        _validar_pais_generico(db, raw["terceiro_lugar_id"], "terceiro lugar")
        p.terceiro_lugar_id = raw["terceiro_lugar_id"]
    if "artilheiro_pais_id" in raw:
        _validar_pais_generico(db, raw["artilheiro_pais_id"], "país do artilheiro")
        p.artilheiro_pais_id = raw["artilheiro_pais_id"]

    _validar_podio_palpite(p)
    db.commit()
    db.refresh(p)
    return p


def recalcular_palpites_especiais_stub(db: Session) -> None:
    """Recalcula pontuação de todos os palpites especiais (§10.3)."""
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_especiais(db)
