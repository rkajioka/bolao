from pydantic import BaseModel, Field, field_validator


class ComunicadoEquipeRequest(BaseModel):
    assunto: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1, max_length=4000)

    @field_validator("assunto", "mensagem", mode="before")
    @classmethod
    def strip_obrigatorio(cls, v: str) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("Campo obrigatório")
        return s


class ComunicadoEquipePreviewResponse(BaseModel):
    total_destinatarios: int
    modo_teste: bool


class ComunicadoEquipeResponse(BaseModel):
    total_destinatarios: int
    enfileirado: bool = True
    modo_teste: bool
