from datetime import datetime

from pydantic import BaseModel, Field


class PalpiteJogoBase(BaseModel):
    palpite_casa: int | None = Field(default=None, ge=0)
    palpite_fora: int | None = Field(default=None, ge=0)
    palpite_classificado_id: int | None = Field(default=None, ge=1)


class PalpiteJogoCreate(PalpiteJogoBase):
    jogo_id: int = Field(ge=1)


class PalpiteJogoRead(PalpiteJogoBase):
    model_config = {"from_attributes": True}

    id: int
    usuario_id: int
    jogo_id: int
    pontuacao_placar: int
    pontuacao_resultado: int
    pontuacao_classificado: int
    pontuacao_marcadores_brasil: int
    pontuacao_total: int
    created_at: datetime
    updated_at: datetime
