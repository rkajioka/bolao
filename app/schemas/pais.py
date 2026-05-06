from datetime import datetime

from pydantic import BaseModel, Field


class PaisBase(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    sigla: str = Field(min_length=1, max_length=8)
    bandeira_url: str = Field(min_length=1, max_length=2048)
    grupo: str | None = Field(default=None, max_length=16)


class PaisCreate(PaisBase):
    pass


class PaisRead(PaisBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
