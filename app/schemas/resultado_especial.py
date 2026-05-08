from datetime import datetime

from pydantic import BaseModel, Field


class ResultadoEspecialBase(BaseModel):
    campeao_id: int | None = Field(default=None, ge=1)
    vice_campeao_id: int | None = Field(default=None, ge=1)
    terceiro_lugar_id: int | None = Field(default=None, ge=1)
    artilheiro_pais_id: int | None = Field(default=None, ge=1)
    finalizado: bool = False


class ResultadoEspecialWrite(ResultadoEspecialBase):
    pass


class ResultadoEspecialRead(ResultadoEspecialBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
