from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.password_policy import validar_complexidade_senha


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize(cls, v: str) -> str:
        if isinstance(v, str):
            return _normalize_email(v)
        return v


class ForgotPasswordResponse(BaseModel):
    mensagem: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    nova_senha: str = Field(min_length=8, max_length=128)
    confirmar_senha: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def senhas_coincidem(self) -> "ResetPasswordRequest":
        if self.nova_senha != self.confirmar_senha:
            raise ValueError("Senha e confirmação devem coincidir")
        validar_complexidade_senha(self.nova_senha)
        return self


class PasswordResetTokenInfo(BaseModel):
    """Exposto temporariamente no admin para testes sem e-mail real."""
    token: str
    expiracao: str
