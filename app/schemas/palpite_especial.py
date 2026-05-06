from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.pais import PaisRead


class UsuarioMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str


class PalpiteEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    melhor_jogador: str | None = Field(default=None, max_length=255)
    artilheiro: str | None = Field(default=None, max_length=255)
    melhor_goleiro: str | None = Field(default=None, max_length=255)


class PalpiteEspecialCreate(PalpiteEspecialBase):
    """Cria o único registro de palpites especiais do usuário (campos opcionais no MVP)."""


class PalpiteEspecialUpdate(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    melhor_jogador: str | None = Field(default=None, max_length=255)
    artilheiro: str | None = Field(default=None, max_length=255)
    melhor_goleiro: str | None = Field(default=None, max_length=255)

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
    pontuacao_melhor_jogador: int
    pontuacao_artilheiro: int
    pontuacao_melhor_goleiro: int
    pontuacao_total: int
    bloqueado: bool
    created_at: datetime
    updated_at: datetime
    campeao: PaisRead | None = None


class PalpiteEspecialAdminRead(PalpiteEspecialRead):
    usuario: UsuarioMini
