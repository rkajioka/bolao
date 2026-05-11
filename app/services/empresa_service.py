import re
import unicodedata

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


def _codigo_base_from_nome(nome: str) -> str:
    texto = unicodedata.normalize("NFKD", nome.strip())
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    texto = texto.upper()
    texto = re.sub(r"[^A-Z0-9]+", "_", texto)
    texto = re.sub(r"_+", "_", texto).strip("_")
    if len(texto) < 2:
        texto = "EMP"
    return texto[:60]


def gerar_codigo_empresa_unico(db: Session, nome: str) -> str:
    base = _codigo_base_from_nome(nome)
    candidato = base
    sufixo = 2
    while get_by_codigo(db, candidato) is not None:
        candidato = f"{base}_{sufixo}"
        sufixo += 1
    return candidato[:64]


def create_empresa(db: Session, data: EmpresaCreate) -> Empresa:
    codigo = (
        data.codigo_empresa.upper()
        if data.codigo_empresa
        else gerar_codigo_empresa_unico(db, data.nome)
    )
    empresa = Empresa(
        nome=data.nome,
        codigo_empresa=codigo,
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
