from datetime import datetime

from pydantic import BaseModel, Field


class ResultadoEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    melhor_jogador: str | None = Field(default=None, max_length=255)
    artilheiro: str | None = Field(default=None, max_length=255)
    melhor_goleiro: str | None = Field(default=None, max_length=255)
    finalizado: bool = False


class ResultadoEspecialWrite(ResultadoEspecialBase):
    pass


class ResultadoEspecialRead(ResultadoEspecialBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
