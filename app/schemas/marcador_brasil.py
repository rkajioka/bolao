from datetime import datetime

from pydantic import BaseModel, Field


class MarcadorBrasilPalpiteBase(BaseModel):
    nome_jogador: str = Field(min_length=1, max_length=255)
    quantidade_gols: int = Field(ge=0)


class MarcadorBrasilPalpiteRead(MarcadorBrasilPalpiteBase):
    model_config = {"from_attributes": True}

    id: int
    palpite_jogo_id: int
    pontuacao: int
    created_at: datetime
    updated_at: datetime


class MarcadorBrasilResultadoBase(BaseModel):
    nome_jogador: str = Field(min_length=1, max_length=255)
    quantidade_gols: int = Field(ge=0)


class MarcadorBrasilResultadoRead(MarcadorBrasilResultadoBase):
    model_config = {"from_attributes": True}

    id: int
    jogo_id: int
    created_at: datetime
    updated_at: datetime
