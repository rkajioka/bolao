from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.pais import Pais
from app.schemas.pais import PaisCreate, PaisUpdate


def _normalize_sigla(sigla: str) -> str:
    return sigla.strip().upper()


def get_by_id(db: Session, pais_id: int) -> Pais | None:
    return db.get(Pais, pais_id)


def get_by_sigla(db: Session, sigla: str) -> Pais | None:
    s = _normalize_sigla(sigla)
    return db.scalar(select(Pais).where(func.upper(Pais.sigla) == s))


def list_paises(db: Session, grupo: str | None = None) -> list[Pais]:
    q = select(Pais).order_by(Pais.grupo.asc(), Pais.nome.asc())
    if grupo is not None:
        g = grupo.strip().upper()
        if g:
            q = q.where(func.upper(Pais.grupo) == g)
    return list(db.scalars(q).all())


def create_pais(db: Session, data: PaisCreate) -> Pais:
    sigla_n = _normalize_sigla(data.sigla)
    if get_by_sigla(db, sigla_n) is not None:
        raise ValueError("Sigla já cadastrada")

    p = Pais(
        nome=data.nome.strip(),
        sigla=sigla_n,
        bandeira_url=data.bandeira_url.strip(),
        grupo=data.grupo.strip().upper() if data.grupo else None,
    )
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(p)
    return p


def update_pais(db: Session, pais: Pais, data: PaisUpdate) -> Pais:
    if data.nome is not None:
        pais.nome = data.nome.strip()
    if data.sigla is not None:
        sigla_n = _normalize_sigla(data.sigla)
        other = get_by_sigla(db, sigla_n)
        if other is not None and other.id != pais.id:
            raise ValueError("Sigla já cadastrada")
        pais.sigla = sigla_n
    if data.bandeira_url is not None:
        pais.bandeira_url = data.bandeira_url.strip()
    if data.grupo is not None:
        pais.grupo = data.grupo.strip().upper() if data.grupo.strip() else None
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(pais)
    return pais
