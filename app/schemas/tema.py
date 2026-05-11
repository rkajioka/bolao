from datetime import datetime

from pydantic import BaseModel, Field


class TemaTokens(BaseModel):
    tokens_dark: dict[str, str] = Field(min_length=1)
    tokens_light: dict[str, str] = Field(min_length=1)


class TemaRead(TemaTokens):
    updated_at: datetime | None = None


class EmpresaTemaRead(TemaRead):
    empresa_id: int
