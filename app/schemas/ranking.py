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
    model_config = {"from_attributes": True}

    usuario_id: int
    nome: str
    valor: int = Field(ge=0)


class InsightMetricaEmpresaRead(BaseModel):
    chave: str
    label: str
    valor: int = Field(ge=0)
    total: int | None = Field(default=None, ge=0)


class DestaquesUsuariosRead(BaseModel):
    pontos_bloco: list[InsightDestaqueRead]
    placar_exato: list[InsightDestaqueRead]
    resultado: list[InsightDestaqueRead]
    classificado: list[InsightDestaqueRead]


class RankingInsightsRead(BaseModel):
    periodo_chave: str | None = None
    periodo_label: str
    periodo_tipo: str = Field(pattern="^(rodada_grupos|fase_mata_mata|sem_periodo)$")
    periodo_status: str = Field(
        pattern="^(aguardando_primeiro_bloco|disponivel|bloco_em_andamento)$"
    )
    periodo_em_andamento_label: str | None = None
    jogos_periodo: int = Field(ge=0)
    participantes_empresa: int = Field(ge=0)
    participantes_com_palpite_no_bloco: int = Field(ge=0)
    metricas_empresa: list[InsightMetricaEmpresaRead]
    destaques_usuarios: DestaquesUsuariosRead
    meu_preenchidos: int = Field(ge=0)
    meu_acertos_resultado: int = Field(ge=0)
    meu_acertos_placar_exato: int = Field(ge=0)
    meus_acertos_classificado: int = Field(ge=0)
    meus_pontos_periodo: int = Field(ge=0)
    minha_posicao_periodo: int | None = Field(default=None, ge=1)
