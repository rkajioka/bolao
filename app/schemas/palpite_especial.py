from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.especiais_common import validar_podio_sem_pais_repetido
from app.schemas.pais import PaisRead


class UsuarioMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str


class PalpiteEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    vice_campeao_id: int | None = Field(default=None, ge=1)
    terceiro_lugar_id: int | None = Field(default=None, ge=1)
    artilheiro_pais_id: int | None = Field(default=None, ge=1)


class PalpiteEspecialCreate(PalpiteEspecialBase):
    """Cria o único registro de palpites especiais do usuário (campos opcionais no MVP)."""

    @model_validator(mode="after")
    def podio_sem_repeticao(self) -> "PalpiteEspecialCreate":
        validar_podio_sem_pais_repetido(
            campeao_id=self.campeao_id,
            vice_campeao_id=self.vice_campeao_id,
            terceiro_lugar_id=self.terceiro_lugar_id,
        )
        return self


class PalpiteEspecialUpdate(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    vice_campeao_id: int | None = Field(default=None, ge=1)
    terceiro_lugar_id: int | None = Field(default=None, ge=1)
    artilheiro_pais_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def at_least_one(self) -> "PalpiteEspecialUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


class PalpiteEspecialRead(PalpiteEspecialBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int
    pontuacao_campeao: int
    pontuacao_vice_campeao: int
    pontuacao_terceiro_lugar: int
    pontuacao_artilheiro_pais: int
    pontuacao_total: int
    bloqueado: bool
    created_at: datetime
    updated_at: datetime
    campeao: PaisRead | None = None
    vice_campeao: PaisRead | None = None
    terceiro_lugar: PaisRead | None = None
    artilheiro_pais: PaisRead | None = None


class PalpiteEspecialAdminRead(PalpiteEspecialRead):
    usuario: UsuarioMini
