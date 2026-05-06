from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UsuarioBase(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    email: EmailStr
    funcao: str | None = Field(default=None, max_length=255)
    imagem_perfil: str | None = Field(default=None, max_length=2048)
    tipo_usuario: str = Field(pattern="^(admin|usuario)$")
    ativo: bool = True
    primeiro_login: bool = True


class UsuarioCreate(UsuarioBase):
    senha_plana: str = Field(min_length=8, max_length=128)


class UsuarioRead(UsuarioBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
