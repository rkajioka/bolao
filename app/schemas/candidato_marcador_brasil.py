from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class CandidatoMarcadorBrasilCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255)


class CandidatoMarcadorBrasilUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    ativo: bool | None = None

    @model_validator(mode="after")
    def at_least_one(self) -> "CandidatoMarcadorBrasilUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


class CandidatoMarcadorBrasilRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nome: str
    ativo: bool
    created_at: datetime
    updated_at: datetime
