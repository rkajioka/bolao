from pydantic import BaseModel, Field


class RankingLinhaRead(BaseModel):
    """Uma linha do ranking geral (§24, §16.7 — backend com todos os componentes)."""

    posicao: int = Field(ge=1)
    usuario_id: int
    nome: str
    funcao: str | None = None
    imagem_perfil: str | None = None
    campeao_id: int | None = None
    vice_campeao_id: int | None = None
    terceiro_lugar_id: int | None = None
    artilheiro_pais_id: int | None = None
    pontos_jogos: int = Field(ge=0, description="Placar + resultado + classificado (sem bônus Brasil)")
    pontos_especiais: int = Field(ge=0)
    bonus_brasil: int = Field(ge=0, description="Soma de pontuacao_marcadores_brasil nos palpites de jogos")
    pontos_totais: int = Field(ge=0)


class RankingResponse(BaseModel):
    linhas: list[RankingLinhaRead]


class InsightDestaqueRead(BaseModel):
    usuario_id: int
    nome: str
    valor: int = Field(ge=0)


class RankingInsightsRead(BaseModel):
    periodo_label: str
    periodo_tipo: str = Field(pattern="^(rodada_grupos|fase_mata_mata|sem_periodo)$")
    jogos_periodo: int = Field(ge=0)
    destaques_resultado: list[InsightDestaqueRead]
    destaques_placar_exato: list[InsightDestaqueRead]
    destaques_marcadores_br: list[InsightDestaqueRead]
    meu_preenchidos: int = Field(ge=0)
    meu_acertos_resultado: int = Field(ge=0)
    meu_acertos_placar_exato: int = Field(ge=0)
    meu_bonus_marcadores_br: int = Field(ge=0)
    meus_pontos_periodo: int = Field(ge=0)
