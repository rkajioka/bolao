from datetime import datetime

from pydantic import BaseModel, Field


class PalpiteEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    melhor_jogador: str | None = Field(default=None, max_length=255)
    artilheiro: str | None = Field(default=None, max_length=255)
    melhor_goleiro: str | None = Field(default=None, max_length=255)


class PalpiteEspecialCreate(PalpiteEspecialBase):
    pass


class PalpiteEspecialRead(PalpiteEspecialBase):
    model_config = {"from_attributes": True}

    id: int
    usuario_id: int
    pontuacao_campeao: int
    pontuacao_melhor_jogador: int
    pontuacao_artilheiro: int
    pontuacao_melhor_goleiro: int
    pontuacao_total: int
    bloqueado: bool
    created_at: datetime
    updated_at: datetime
