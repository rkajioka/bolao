from datetime import datetime

from pydantic import BaseModel, Field


class ConfiguracaoBolaoBase(BaseModel):
    data_bloqueio_palpites_especiais: datetime | None = None
    pontos_campeao: int = Field(ge=0)
    pontos_melhor_jogador: int = Field(ge=0)
    pontos_artilheiro: int = Field(ge=0)
    pontos_melhor_goleiro: int = Field(ge=0)
    pontos_placar_exato: int = Field(ge=0)
    pontos_resultado_correto: int = Field(ge=0)
    pontos_classificado_mata_mata: int = Field(ge=0)
    pontos_marcador_brasil: int = Field(ge=0)
    pontos_marcador_brasil_com_quantidade: int = Field(ge=0)


class ConfiguracaoBolaoRead(ConfiguracaoBolaoBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime


class ConfiguracaoBolaoWrite(ConfiguracaoBolaoBase):
    """Corpo do PUT — substitui todos os campos configuráveis da linha ativa."""
