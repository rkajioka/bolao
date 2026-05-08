from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class PontuacaoFaseItem(BaseModel):
    fase_key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=128)
    ordem: int = Field(ge=0)
    pontos_placar_exato: int = Field(ge=0)
    pontos_resultado_correto: int = Field(ge=0)
    pontos_classificado_mata_mata: int = Field(ge=0)


class PontuacaoFaseRead(PontuacaoFaseItem):
    model_config = {"from_attributes": True}
    id: int
    created_at: datetime
    updated_at: datetime


class PontuacaoFaseBulkWrite(BaseModel):
    itens: list[PontuacaoFaseItem]

    @model_validator(mode="after")
    def validar_unicos(self) -> "PontuacaoFaseBulkWrite":
        keys = [x.fase_key for x in self.itens]
        if len(keys) != len(set(keys)):
            raise ValueError("fase_key duplicada no payload")
        return self
