from pydantic import BaseModel, Field


class GruposListResponse(BaseModel):
    """Códigos de grupos que possuem jogos da fase de grupos cadastrados."""

    grupos: list[str] = Field(description="Códigos ordenados (ex.: A, B, C)")


class TabelaGrupoLinhaRead(BaseModel):
    """Uma linha da tabela da Copa para o grupo (§8.4)."""

    posicao: int = Field(ge=1)
    pais_id: int
    nome: str
    sigla: str
    bandeira_url: str
    pontos: int = Field(ge=0)
    jogos: int = Field(ge=0)
    vitorias: int = Field(ge=0)
    empates: int = Field(ge=0)
    derrotas: int = Field(ge=0)
    gols_pro: int = Field(ge=0)
    gols_contra: int = Field(ge=0)
    saldo_gols: int


class TabelaGrupoResponse(BaseModel):
    grupo: str
    linhas: list[TabelaGrupoLinhaRead]
