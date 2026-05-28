from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.services.convite_service import convite_esta_pendente


def contar_usuarios(db: Session, empresa_id: int) -> int:
    total = db.scalar(
        select(func.count()).select_from(Usuario).where(Usuario.empresa_id == empresa_id)
    )
    return int(total or 0)


def contar_convites_pendentes(db: Session, empresa_id: int) -> int:
    rows = db.scalars(select(Convite).where(Convite.empresa_id == empresa_id)).all()
    return sum(1 for c in rows if convite_esta_pendente(c))


def ocupacao_atual(db: Session, empresa_id: int, *, reservas_extras: int = 0) -> int:
    return contar_usuarios(db, empresa_id) + contar_convites_pendentes(db, empresa_id) + reservas_extras


def vagas_restantes(db: Session, empresa: Empresa, *, reservas_extras: int = 0) -> int:
    return max(0, empresa.max_usuarios - ocupacao_atual(db, empresa.id, reservas_extras=reservas_extras))


def pode_adicionar_usuario(db: Session, empresa: Empresa, *, reservas_extras: int = 0) -> bool:
    return vagas_restantes(db, empresa, reservas_extras=reservas_extras) > 0


def validar_limite_usuarios(
    db: Session,
    empresa: Empresa,
    *,
    reservas_extras: int = 0,
) -> None:
    if pode_adicionar_usuario(db, empresa, reservas_extras=reservas_extras):
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"A empresa atingiu o limite de {empresa.max_usuarios} usuários. "
            "Solicite ao proprietário da plataforma o aumento da cota."
        ),
    )
