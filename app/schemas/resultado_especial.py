from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.especiais_common import validar_podio_sem_pais_repetido


class ResultadoEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    vice_campeao_id: int | None = Field(default=None, ge=1)
    terceiro_lugar_id: int | None = Field(default=None, ge=1)
    artilheiro_pais_id: int | None = Field(default=None, ge=1)
    finalizado: bool = False


class ResultadoEspecialWrite(ResultadoEspecialBase):
    @model_validator(mode="after")
    def podio_sem_repeticao(self) -> "ResultadoEspecialWrite":
        validar_podio_sem_pais_repetido(
            campeao_id=self.campeao_id,
            vice_campeao_id=self.vice_campeao_id,
            terceiro_lugar_id=self.terceiro_lugar_id,
        )
        return self


class ResultadoEspecialRead(ResultadoEspecialBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
