from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class UsuarioBase(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    email: EmailStr
    funcao: str | None = Field(default=None, max_length=255)
    imagem_perfil: str | None = Field(default=None, max_length=2048)
    tipo_usuario: str = Field(pattern="^(admin|usuario)$")
    ativo: bool = True
    primeiro_login: bool = True

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return _normalize_email(v)
        return v


class UsuarioCreate(UsuarioBase):
    senha_plana: str = Field(min_length=8, max_length=128)


class UsuarioRead(UsuarioBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime


class UsuarioUpdate(BaseModel):
    """Campos editáveis pelo admin (PUT /usuarios/{id})."""

    nome: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    funcao: str | None = Field(default=None, max_length=255)
    imagem_perfil: str | None = Field(default=None, max_length=2048)
    tipo_usuario: str | None = Field(default=None, pattern="^(admin|usuario)$")

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "UsuarioUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_optional(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            return _normalize_email(v)
        return v


class UsuarioStatusUpdate(BaseModel):
    ativo: bool


class UsuarioResetPasswordBody(BaseModel):
    senha_plana: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_login(cls, v: str) -> str:
        if isinstance(v, str):
            return _normalize_email(v)
        return v


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    primeiro_login: bool


class PrimeiroAcessoRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    funcao: str = Field(min_length=1, max_length=255)
    imagem_perfil: str | None = Field(default=None, max_length=2048)
    nova_senha: str = Field(min_length=8, max_length=128)
    confirmar_senha: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def senhas_coincidem(self) -> "PrimeiroAcessoRequest":
        if self.nova_senha != self.confirmar_senha:
            raise ValueError("Senha e confirmação devem coincidir")
        return self


class ChangePasswordRequest(BaseModel):
    senha_atual: str = Field(min_length=1, max_length=128)
    nova_senha: str = Field(min_length=8, max_length=128)
    confirmar_senha: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def senhas_coincidem(self) -> "ChangePasswordRequest":
        if self.nova_senha != self.confirmar_senha:
            raise ValueError("Senha e confirmação devem coincidir")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_forgot(cls, v: str) -> str:
        if isinstance(v, str):
            return _normalize_email(v)
        return v


class ForgotPasswordResponse(BaseModel):
    mensagem: str
