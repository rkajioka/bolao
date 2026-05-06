from pydantic import BaseModel, Field


class RankingLinhaRead(BaseModel):
    """Uma linha do ranking geral (§24, §16.7 — backend com todos os componentes)."""

    posicao: int = Field(ge=1)
    usuario_id: int
    nome: str
    funcao: str | None = None
    imagem_perfil: str | None = None
    pontos_jogos: int = Field(ge=0, description="Placar + resultado + classificado (sem bônus Brasil)")
    pontos_especiais: int = Field(ge=0)
    bonus_brasil: int = Field(ge=0, description="Soma de pontuacao_marcadores_brasil nos palpites de jogos")
    pontos_totais: int = Field(ge=0)


class RankingResponse(BaseModel):
    linhas: list[RankingLinhaRead]
