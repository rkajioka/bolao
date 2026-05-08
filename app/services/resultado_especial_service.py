"""
Resultado oficial dos palpites especiais — um único registro por bolão (§7.6).

CRUD admin (§20.8). Ao salvar ou finalizar, dispara recálculo via `pontuacao_service`.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resultado_especial import ResultadoEspecial
from app.schemas.resultado_especial import ResultadoEspecialWrite
from app.services import pais_service


def obter_singleton(db: Session) -> ResultadoEspecial | None:
    return db.scalar(select(ResultadoEspecial).order_by(ResultadoEspecial.id.asc()).limit(1))


def _strip_opt(s: str | None) -> str | None:
    if s is None or not str(s).strip():
        return None
    return str(s).strip()


def _validar_campeao(db: Session, campeao_id: int | None) -> None:
    if campeao_id is None:
        return
    if pais_service.get_by_id(db, campeao_id) is None:
        raise ValueError("País campeão não encontrado")


def _validar_pais_generico(db: Session, pais_id: int | None, label: str) -> None:
    if pais_id is None:
        return
    if pais_service.get_by_id(db, pais_id) is None:
        raise ValueError(f"País de {label} não encontrado")


def criar(db: Session, data: ResultadoEspecialWrite) -> ResultadoEspecial:
    if obter_singleton(db) is not None:
        raise ValueError("Resultado especial já existe; use PUT para alterar")
    _validar_campeao(db, data.campeao_id)
    _validar_pais_generico(db, data.vice_campeao_id, "vice-campeão")
    _validar_pais_generico(db, data.terceiro_lugar_id, "terceiro lugar")
    _validar_pais_generico(db, data.artilheiro_pais_id, "artilheiro")
    row = ResultadoEspecial(
        campeao_id=data.campeao_id,
        vice_campeao_id=data.vice_campeao_id,
        terceiro_lugar_id=data.terceiro_lugar_id,
        artilheiro_pais_id=data.artilheiro_pais_id,
        melhor_jogador=_strip_opt(data.melhor_jogador),
        artilheiro=_strip_opt(data.artilheiro),
        melhor_goleiro=_strip_opt(data.melhor_goleiro),
        finalizado=data.finalizado,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(row)
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_especiais(db)
    return row  # type: ignore[return-value]


def atualizar(db: Session, data: ResultadoEspecialWrite) -> ResultadoEspecial:
    row = obter_singleton(db)
    if row is None:
        raise ValueError("Resultado especial não encontrado; use POST para criar")
    _validar_campeao(db, data.campeao_id)
    _validar_pais_generico(db, data.vice_campeao_id, "vice-campeão")
    _validar_pais_generico(db, data.terceiro_lugar_id, "terceiro lugar")
    _validar_pais_generico(db, data.artilheiro_pais_id, "artilheiro")
    row.campeao_id = data.campeao_id
    row.vice_campeao_id = data.vice_campeao_id
    row.terceiro_lugar_id = data.terceiro_lugar_id
    row.artilheiro_pais_id = data.artilheiro_pais_id
    row.melhor_jogador = _strip_opt(data.melhor_jogador)
    row.artilheiro = _strip_opt(data.artilheiro)
    row.melhor_goleiro = _strip_opt(data.melhor_goleiro)
    row.finalizado = data.finalizado
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(row)
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_especiais(db)
    return row


def finalizar(db: Session) -> ResultadoEspecial:
    row = obter_singleton(db)
    if row is None:
        raise ValueError("Resultado especial não encontrado; use POST para criar")
    row.finalizado = True
    db.commit()
    db.refresh(row)
    from app.services import pontuacao_service

    pontuacao_service.recalcular_todos_palpites_especiais(db)
    return row
