from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidato_marcador_brasil import CandidatoMarcadorBrasil
from app.schemas.candidato_marcador_brasil import CandidatoMarcadorBrasilCreate, CandidatoMarcadorBrasilUpdate


def listar_ativos(db: Session) -> list[CandidatoMarcadorBrasil]:
    return list(
        db.scalars(
            select(CandidatoMarcadorBrasil)
            .where(CandidatoMarcadorBrasil.ativo.is_(True))
            .order_by(CandidatoMarcadorBrasil.nome.asc())
        ).all()
    )


def listar_todos(db: Session) -> list[CandidatoMarcadorBrasil]:
    return list(db.scalars(select(CandidatoMarcadorBrasil).order_by(CandidatoMarcadorBrasil.nome.asc())).all())


def get_by_id(db: Session, candidato_id: int) -> CandidatoMarcadorBrasil | None:
    return db.get(CandidatoMarcadorBrasil, candidato_id)


def criar(db: Session, data: CandidatoMarcadorBrasilCreate) -> CandidatoMarcadorBrasil:
    nome = data.nome.strip()
    row = CandidatoMarcadorBrasil(nome=nome, ativo=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def atualizar(db: Session, row: CandidatoMarcadorBrasil, data: CandidatoMarcadorBrasilUpdate) -> CandidatoMarcadorBrasil:
    if data.nome is not None:
        row.nome = data.nome.strip()
    if data.ativo is not None:
        row.ativo = data.ativo
    db.commit()
    db.refresh(row)
    return row
