from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.avatar_url import validar_avatar_url
from app.core.password_policy import validar_complexidade_senha


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class ConviteRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empresa_id: int
    email: str
    token: str
    expiracao: datetime
    usado_em: datetime | None
    criado_por: int | None
    created_at: datetime

    @property
    def expirado(self) -> bool:
        from datetime import UTC
        return self.expiracao <= datetime.now(UTC)

    @property
    def usado(self) -> bool:
        return self.usado_em is not None

    @property
    def status(self) -> str:
        if self.usado_em is not None:
            return "usado"
        from datetime import UTC
        if self.expiracao <= datetime.now(UTC):
            return "expirado"
        return "pendente"


class ConviteReadPublic(BaseModel):
    """Resposta pública para o admin — sem token de convite."""
    model_config = {"from_attributes": True}

    id: int
    email: str
    expiracao: datetime
    status: str
    criado_por: int | None
    created_at: datetime


class ConviteResultadoItem(BaseModel):
    email: str
    status: str
    expiracao: str | None = None
    convite_enviado_por_email: bool | None = None
    email_tentativas: int | None = None
    email_erro: str | None = None


class ConviteResumoEnvio(BaseModel):
    total: int
    enviados: int
    falhas: int
    bloqueados_limite: int = 0
    alerta_admins_enviado: bool
    alerta_owners_limite_enviado: bool = False


class BulkConviteResponse(BaseModel):
    itens: list[ConviteResultadoItem]
    resumo_envio: ConviteResumoEnvio


class ProvisionarExpiradosItem(BaseModel):
    email: str
    status: str
    detalhe: str | None = None


class ProvisionarExpiradosResponse(BaseModel):
    total: int
    provisionados: int
    erros: int
    itens: list[ProvisionarExpiradosItem]


class BulkConviteRequest(BaseModel):
    emails: list[EmailStr] = Field(min_length=1, max_length=50)

    @field_validator("emails", mode="before")
    @classmethod
    def normalize_emails(cls, v: list) -> list:
        return [_normalize_email(str(e)) for e in v]


class AtivarContaRequest(BaseModel):
    token: str = Field(min_length=1)
    nome: str = Field(min_length=1, max_length=255)
    senha: str = Field(min_length=8, max_length=128)
    confirmar_senha: str = Field(min_length=8, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @model_validator(mode="after")
    def senhas_coincidem(self) -> "AtivarContaRequest":
        if self.senha != self.confirmar_senha:
            raise ValueError("Senha e confirmação devem coincidir")
        validar_complexidade_senha(self.senha)
        return self

    @field_validator("avatar_url")
    @classmethod
    def validar_avatar(cls, value: str | None) -> str | None:
        return validar_avatar_url(value)


class AtivarContaResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AvatarPreAtivacaoResponse(BaseModel):
    avatar_url: str
