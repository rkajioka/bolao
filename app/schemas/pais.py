from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class PaisBase(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    sigla: str = Field(min_length=2, max_length=8, description="Sigla FIFA/ISO usada na URL da bandeira, ex.: BR, MX")
    bandeira_url: str = Field(min_length=1, max_length=2048)
    grupo: str | None = Field(default=None, max_length=16)


class PaisCreate(PaisBase):
    pass


class PaisUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    sigla: str | None = Field(default=None, min_length=2, max_length=8)
    bandeira_url: str | None = Field(default=None, min_length=1, max_length=2048)
    grupo: str | None = Field(default=None, max_length=16)

    @model_validator(mode="after")
    def at_least_one(self) -> "PaisUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


class PaisRead(PaisBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
