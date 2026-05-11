import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate, EmpresaRead, EmpresaUpdate
from app.services import empresa_bootstrap_service, empresa_quota_service


def get_by_id(db: Session, empresa_id: int) -> Empresa | None:
    return db.get(Empresa, empresa_id)


def marcadores_brasil_habilitado(db: Session, empresa_id: int | None) -> bool:
    if empresa_id is None:
        return False
    empresa = get_by_id(db, empresa_id)
    if empresa is None:
        return False
    return bool(empresa.marcadores_brasil_habilitado)


def get_by_codigo(db: Session, codigo: str) -> Empresa | None:
    return db.scalar(
        select(Empresa).where(Empresa.codigo_empresa == codigo.upper())
    )


def list_empresas(db: Session) -> list[Empresa]:
    return list(db.scalars(select(Empresa).order_by(Empresa.id.asc())).all())


def empresa_para_read(db: Session, empresa: Empresa) -> EmpresaRead:
    total_usuarios = empresa_quota_service.contar_usuarios(db, empresa.id)
    convites_pendentes = empresa_quota_service.contar_convites_pendentes(db, empresa.id)
    ocupacao = total_usuarios + convites_pendentes
    return EmpresaRead(
        id=empresa.id,
        nome=empresa.nome,
        codigo_empresa=empresa.codigo_empresa,
        ativo=empresa.ativo,
        marcadores_brasil_habilitado=empresa.marcadores_brasil_habilitado,
        max_usuarios=empresa.max_usuarios,
        total_usuarios=total_usuarios,
        convites_pendentes=convites_pendentes,
        vagas_restantes=max(0, empresa.max_usuarios - ocupacao),
        created_at=empresa.created_at,
        updated_at=empresa.updated_at,
    )


def list_empresas_read(db: Session) -> list[EmpresaRead]:
    return [empresa_para_read(db, empresa) for empresa in list_empresas(db)]


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


def create_empresa(db: Session, data: EmpresaCreate) -> EmpresaRead:
    codigo = (
        data.codigo_empresa.upper()
        if data.codigo_empresa
        else gerar_codigo_empresa_unico(db, data.nome)
    )
    empresa = Empresa(
        nome=data.nome,
        codigo_empresa=codigo,
        marcadores_brasil_habilitado=data.marcadores_brasil_habilitado,
        max_usuarios=data.max_usuarios,
    )
    db.add(empresa)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(empresa)
    empresa_bootstrap_service.bootstrap_empresa_defaults(db, empresa.id)
    return empresa_para_read(db, empresa)


def update_empresa(db: Session, empresa: Empresa, data: EmpresaUpdate) -> EmpresaRead:
    flag_anterior = bool(empresa.marcadores_brasil_habilitado)
    if data.nome is not None:
        empresa.nome = data.nome
    if data.ativo is not None:
        empresa.ativo = data.ativo
    if data.marcadores_brasil_habilitado is not None:
        empresa.marcadores_brasil_habilitado = data.marcadores_brasil_habilitado
    if data.max_usuarios is not None:
        ocupacao = empresa_quota_service.ocupacao_atual(db, empresa.id)
        if data.max_usuarios < ocupacao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"A cota não pode ser menor que a ocupação atual ({ocupacao} usuários/convites pendentes)."
                ),
            )
        empresa.max_usuarios = data.max_usuarios
    db.commit()
    db.refresh(empresa)
    if data.marcadores_brasil_habilitado is not None and flag_anterior != bool(
        empresa.marcadores_brasil_habilitado
    ):
        from app.services import pontuacao_service

        pontuacao_service.recalcular_pontuacao_empresa(db, empresa.id)
    return empresa_para_read(db, empresa)
