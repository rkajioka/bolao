from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate, EmpresaUpdate
from app.services import empresa_bootstrap_service


def get_by_id(db: Session, empresa_id: int) -> Empresa | None:
    return db.get(Empresa, empresa_id)


def get_by_codigo(db: Session, codigo: str) -> Empresa | None:
    return db.scalar(
        select(Empresa).where(Empresa.codigo_empresa == codigo.upper())
    )


def list_empresas(db: Session) -> list[Empresa]:
    return list(db.scalars(select(Empresa).order_by(Empresa.id.asc())).all())


def create_empresa(db: Session, data: EmpresaCreate) -> Empresa:
    empresa = Empresa(
        nome=data.nome,
        codigo_empresa=data.codigo_empresa.upper(),
    )
    db.add(empresa)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(empresa)
    empresa_bootstrap_service.bootstrap_empresa_defaults(db, empresa.id)
    return empresa


def update_empresa(db: Session, empresa: Empresa, data: EmpresaUpdate) -> Empresa:
    if data.nome is not None:
        empresa.nome = data.nome
    if data.ativo is not None:
        empresa.ativo = data.ativo
    db.commit()
    db.refresh(empresa)
    return empresa
