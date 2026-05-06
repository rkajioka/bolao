from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.grupo import GruposListResponse, TabelaGrupoLinhaRead, TabelaGrupoResponse
from app.services import grupo_service

router = APIRouter(prefix="/grupos", tags=["grupos"])


@router.get("", response_model=GruposListResponse)
def get_grupos(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> GruposListResponse:
    return GruposListResponse(grupos=grupo_service.listar_codigos_grupos_com_jogos(db))


@router.get("/{grupo}/tabela", response_model=TabelaGrupoResponse)
def get_grupo_tabela(
    grupo: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_active_user),
) -> TabelaGrupoResponse:
    try:
        cod = grupo_service.normalizar_codigo_grupo(grupo)
        linhas_svc = grupo_service.calcular_tabela_grupo(db, cod)
    except ValueError as e:
        msg = str(e).lower()
        st = (
            status.HTTP_404_NOT_FOUND
            if "não encontrado" in msg or "inválido" in msg
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=st, detail=str(e)) from e

    linhas = [
        TabelaGrupoLinhaRead(
            posicao=i + 1,
            pais_id=s.pais_id,
            nome=s.nome,
            sigla=s.sigla,
            bandeira_url=s.bandeira_url,
            pontos=s.pontos,
            jogos=s.jogos,
            vitorias=s.vitorias,
            empates=s.empates,
            derrotas=s.derrotas,
            gols_pro=s.gols_pro,
            gols_contra=s.gols_contra,
            saldo_gols=s.saldo_gols,
        )
        for i, s in enumerate(linhas_svc)
    ]
    return TabelaGrupoResponse(grupo=cod, linhas=linhas)
