from datetime import datetime

from pydantic import BaseModel, Field


class EmpresaRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nome: str
    codigo_empresa: str
    ativo: bool
    marcadores_brasil_habilitado: bool
    max_usuarios: int
    total_usuarios: int = 0
    convites_pendentes: int = 0
    vagas_restantes: int = 0
    created_at: datetime
    updated_at: datetime


class EmpresaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    codigo_empresa: str | None = Field(
        default=None,
        min_length=2,
        max_length=64,
        pattern=r"^[A-Z0-9_-]+$",
    )
    marcadores_brasil_habilitado: bool = False
    max_usuarios: int = Field(ge=1, le=100_000)


class EmpresaUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    ativo: bool | None = None
    marcadores_brasil_habilitado: bool | None = None
    max_usuarios: int | None = Field(default=None, ge=1, le=100_000)
