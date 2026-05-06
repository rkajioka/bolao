from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.jogo import JogoRead


class PalpiteJogoBase(BaseModel):
    palpite_casa: int | None = Field(default=None, ge=0)
    palpite_fora: int | None = Field(default=None, ge=0)
    palpite_classificado_id: int | None = Field(default=None, ge=1)


class PalpiteJogoCreate(PalpiteJogoBase):
    jogo_id: int = Field(ge=1)

    @model_validator(mode="after")
    def placares_obrigatorios(self) -> "PalpiteJogoCreate":
        if self.palpite_casa is None or self.palpite_fora is None:
            raise ValueError("Informe palpite da casa e palpite de fora")
        return self


class PalpiteJogoUpdate(BaseModel):
    palpite_casa: int | None = Field(default=None, ge=0)
    palpite_fora: int | None = Field(default=None, ge=0)
    palpite_classificado_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def at_least_one(self) -> "PalpiteJogoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


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
    jogo: JogoRead
