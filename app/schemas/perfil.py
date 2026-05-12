from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.avatar_url import validar_avatar_url
from app.core.password_policy import validar_complexidade_senha


class PerfilUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=255)
    funcao: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @model_validator(mode="after")
    def require_at_least_one(self) -> "PerfilUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self

    @field_validator("avatar_url")
    @classmethod
    def validar_avatar(cls, value: str | None) -> str | None:
        return validar_avatar_url(value)


class AlterarSenhaRequest(BaseModel):
    senha_atual: str = Field(min_length=1, max_length=128)
    nova_senha: str = Field(min_length=8, max_length=128)
    confirmar_senha: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def senhas_coincidem(self) -> "AlterarSenhaRequest":
        if self.nova_senha != self.confirmar_senha:
            raise ValueError("Senha e confirmação devem coincidir")
        validar_complexidade_senha(self.nova_senha)
        return self
