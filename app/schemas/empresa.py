from datetime import datetime

from pydantic import BaseModel, Field


class EmpresaRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nome: str
    codigo_empresa: str
    ativo: bool
    created_at: datetime
    updated_at: datetime


class EmpresaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    codigo_empresa: str = Field(min_length=2, max_length=64, pattern=r"^[A-Z0-9_-]+$")


class EmpresaUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    ativo: bool | None = None
