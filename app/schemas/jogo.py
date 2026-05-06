from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.jogo_fases import canonical_fase_mata_mata


class PaisNoJogo(BaseModel):
    """Dados mínimos do país para exibição em listagens de jogos (bandeira)."""

    model_config = {"from_attributes": True}

    id: int
    nome: str
    sigla: str
    bandeira_url: str
    grupo: str | None = None


class JogoBase(BaseModel):
    fase: str = Field(min_length=1, max_length=128)
    grupo: str | None = Field(default=None, max_length=16)
    tipo_fase: str = Field(pattern="^(grupos|mata_mata)$")
    rodada: int | None = Field(default=None, ge=1)
    pais_casa_id: int = Field(ge=1)
    pais_fora_id: int = Field(ge=1)
    data_jogo: datetime

    @model_validator(mode="after")
    def validar_paises_grupo_rodada_e_fase(self) -> "JogoBase":
        if self.pais_casa_id == self.pais_fora_id:
            raise ValueError("País da casa e país de fora devem ser diferentes")
        if self.tipo_fase == "grupos":
            if not self.grupo or not str(self.grupo).strip():
                raise ValueError("Grupo é obrigatório para jogos da fase de grupos")
            if self.rodada is None:
                raise ValueError("Rodada (número ≥ 1) é obrigatória para jogos de fase de grupos")
            self.fase = str(self.fase).strip()
        else:
            if self.rodada is not None:
                raise ValueError("Rodada não se aplica a mata-mata; omita o campo ou use null")
            self.rodada = None
            self.fase = canonical_fase_mata_mata(self.fase)
        return self


class JogoCreate(JogoBase):
    """Cadastro de jogos de grupos ou mata-mata (admin)."""


class JogoUpdate(BaseModel):
    fase: str | None = Field(default=None, min_length=1, max_length=128)
    grupo: str | None = Field(default=None, max_length=16)
    tipo_fase: str | None = Field(default=None, pattern="^(grupos|mata_mata)$")
    rodada: int | None = Field(default=None, ge=1)
    pais_casa_id: int | None = Field(default=None, ge=1)
    pais_fora_id: int | None = Field(default=None, ge=1)
    data_jogo: datetime | None = None

    @model_validator(mode="after")
    def at_least_one(self) -> "JogoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


class JogoResultadoPatch(BaseModel):
    """Atualização parcial do resultado (admin). Campos omitidos permanecem como estão."""

    placar_casa: int | None = Field(default=None, ge=0)
    placar_fora: int | None = Field(default=None, ge=0)
    teve_prorrogacao: bool | None = None
    foi_para_penaltis: bool | None = None
    penaltis_casa: int | None = Field(default=None, ge=0)
    penaltis_fora: int | None = Field(default=None, ge=0)
    classificado_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def at_least_one(self) -> "JogoResultadoPatch":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo de resultado")
        return self


class JogoRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    fase: str
    grupo: str | None
    tipo_fase: str
    rodada: int | None = None
    data_jogo: datetime
    pais_casa_id: int
    pais_fora_id: int
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
    pais_casa: PaisNoJogo
    pais_fora: PaisNoJogo
    classificado: PaisNoJogo | None = None


class GrupoJogosBlock(BaseModel):
    """Bloco de jogos de um grupo (fase de grupos)."""

    grupo: str
    jogos: list[JogoRead]


class JogosPorGrupoResponse(BaseModel):
    """Lista ordenada por letra de grupo; só inclui grupos que possuem jogos."""

    grupos: list[GrupoJogosBlock]
