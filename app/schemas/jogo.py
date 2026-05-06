from datetime import datetime

from pydantic import BaseModel, Field


class JogoBase(BaseModel):
    fase: str = Field(min_length=1, max_length=128)
    grupo: str | None = Field(default=None, max_length=16)
    tipo_fase: str = Field(pattern="^(grupos|mata_mata)$")
    pais_casa_id: int = Field(ge=1)
    pais_fora_id: int = Field(ge=1)
    data_jogo: datetime


class JogoCreate(JogoBase):
    pass


class JogoRead(JogoBase):
    model_config = {"from_attributes": True}

    id: int
    placar_casa: int | None = None
    placar_fora: int | None = None
    teve_prorrogacao: bool
    foi_para_penaltis: bool
    penaltis_casa: int | None = None
    penaltis_fora: int | None = None
    classificado_id: int | None = None
    finalizado: bool
    created_at: datetime
    updated_at: datetime
