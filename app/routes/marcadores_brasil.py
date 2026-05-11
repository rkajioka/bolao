from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_active_user,
    require_owner,
    require_participante_bolao,
    require_primeiro_login_concluido,
)
from app.database import get_db
from app.models.candidato_marcador_brasil import CandidatoMarcadorBrasil
from app.models.marcador_brasil import MarcadorBrasilPalpite, MarcadorBrasilResultado
from app.models.usuario import Usuario
from app.schemas.candidato_marcador_brasil import (
    CandidatoMarcadorBrasilCreate,
    CandidatoMarcadorBrasilRead,
    CandidatoMarcadorBrasilUpdate,
)
from app.schemas.marcador_brasil import (
    MarcadorBrasilPalpiteRead,
    MarcadorBrasilResultadoRead,
    MarcadoresBrasilPalpiteSync,
    MarcadoresBrasilResultadoSync,
)
from app.services import auditoria_admin_service, candidato_marcador_brasil_service, marcador_brasil_service

router = APIRouter(prefix="/marcadores-brasil", tags=["marcadores-brasil"])


def _http_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc).lower()
    if "não encontrado" in msg:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _http_marcadores_desabilitado(
    exc: marcador_brasil_service.MarcadoresBrasilEmpresaDesabilitadoError,
) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/candidatos/admin", response_model=list[CandidatoMarcadorBrasilRead])
def get_candidatos_marcador_brasil_admin(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_owner),
) -> list[CandidatoMarcadorBrasil]:
    """Lista todos os candidatos (inclui inativos) para gestão no painel admin."""
    return candidato_marcador_brasil_service.listar_todos(db)


@router.get("/candidatos", response_model=list[CandidatoMarcadorBrasilRead])
def get_candidatos_marcador_brasil(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[CandidatoMarcadorBrasil]:
    """Lista nomes ativos para sugestão (dropdown) nos marcadores do Brasil."""
    try:
        marcador_brasil_service.exigir_marcadores_brasil_habilitado_empresa(db, user.empresa_id)
    except marcador_brasil_service.MarcadoresBrasilEmpresaDesabilitadoError as e:
        raise _http_marcadores_desabilitado(e) from e
    return candidato_marcador_brasil_service.listar_ativos(db)


@router.post("/candidatos", response_model=CandidatoMarcadorBrasilRead, status_code=status.HTTP_201_CREATED)
def post_candidato_marcador_brasil(
    data: CandidatoMarcadorBrasilCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_owner),
) -> CandidatoMarcadorBrasil:
    row = candidato_marcador_brasil_service.criar(db, data)
    auditoria_admin_service.registrar_evento(
        db, admin, acao="marcadores_brasil.post_candidato", entidade="candidato_marcador_brasil", entidade_id=row.id
    )
    return row


@router.put("/candidatos/{candidato_id}", response_model=CandidatoMarcadorBrasilRead)
def put_candidato_marcador_brasil(
    candidato_id: int,
    data: CandidatoMarcadorBrasilUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_owner),
) -> CandidatoMarcadorBrasil:
    row = candidato_marcador_brasil_service.get_by_id(db, candidato_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato não encontrado")
    row = candidato_marcador_brasil_service.atualizar(db, row, data)
    auditoria_admin_service.registrar_evento(
        db, admin, acao="marcadores_brasil.put_candidato", entidade="candidato_marcador_brasil", entidade_id=candidato_id
    )
    return row


@router.get("/me/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def get_marcadores_me_jogo(
    jogo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_primeiro_login_concluido),
) -> list[MarcadorBrasilPalpite]:
    try:
        marcador_brasil_service.obter_jogo_que_envolve_brasil(db, jogo_id)
        return marcador_brasil_service.listar_marcadores_palpite_usuario(
            db, user.id, jogo_id, empresa_id=user.empresa_id
        )
    except marcador_brasil_service.MarcadoresBrasilEmpresaDesabilitadoError as e:
        raise _http_marcadores_desabilitado(e) from e
    except ValueError as e:
        raise _http_value_error(e) from e


@router.post("/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def post_marcadores_jogo(
    jogo_id: int,
    body: MarcadoresBrasilPalpiteSync,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_participante_bolao),
) -> list[MarcadorBrasilPalpite]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_palpite(
            db, user.id, jogo_id, body.marcadores, empresa_id=user.empresa_id
        )
    except marcador_brasil_service.MarcadoresBrasilEmpresaDesabilitadoError as e:
        raise _http_marcadores_desabilitado(e) from e
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar os marcadores",
        ) from e


@router.put("/{jogo_id}", response_model=list[MarcadorBrasilPalpiteRead])
def put_marcadores_jogo(
    jogo_id: int,
    body: MarcadoresBrasilPalpiteSync,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_participante_bolao),
) -> list[MarcadorBrasilPalpite]:
    try:
        return marcador_brasil_service.sincronizar_marcadores_palpite(
            db, user.id, jogo_id, body.marcadores, empresa_id=user.empresa_id
        )
    except marcador_brasil_service.MarcadoresBrasilEmpresaDesabilitadoError as e:
        raise _http_marcadores_desabilitado(e) from e
    except ValueError as e:
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar os marcadores",
        ) from e


@router.get("/admin/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def get_marcadores_resultado_admin(
    jogo_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_owner),
) -> list[MarcadorBrasilResultado]:
    try:
        return marcador_brasil_service.listar_marcadores_resultado_admin(db, jogo_id)
    except ValueError as e:
        raise _http_value_error(e) from e


@router.post("/resultado/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def post_marcadores_resultado(
    jogo_id: int,
    body: MarcadoresBrasilResultadoSync,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_owner),
) -> list[MarcadorBrasilResultado]:
    try:
        rows = marcador_brasil_service.sincronizar_marcadores_resultado_admin(db, jogo_id, body)
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="marcadores_brasil.post_resultado",
            entidade="marcador_brasil_resultado",
            entidade_id=jogo_id,
            detalhes={"linhas": len(rows)},
        )
        return rows
    except ValueError as e:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="marcadores_brasil.post_resultado",
            entidade="marcador_brasil_resultado",
            entidade_id=jogo_id,
            status="error",
            detalhes={"erro": str(e)},
        )
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado dos marcadores",
        ) from e


@router.put("/resultado/{jogo_id}", response_model=list[MarcadorBrasilResultadoRead])
def put_marcadores_resultado(
    jogo_id: int,
    body: MarcadoresBrasilResultadoSync,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_owner),
) -> list[MarcadorBrasilResultado]:
    try:
        rows = marcador_brasil_service.sincronizar_marcadores_resultado_admin(db, jogo_id, body)
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="marcadores_brasil.put_resultado",
            entidade="marcador_brasil_resultado",
            entidade_id=jogo_id,
            detalhes={"linhas": len(rows)},
        )
        return rows
    except ValueError as e:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="marcadores_brasil.put_resultado",
            entidade="marcador_brasil_resultado",
            entidade_id=jogo_id,
            status="error",
            detalhes={"erro": str(e)},
        )
        raise _http_value_error(e) from e
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível salvar o resultado dos marcadores",
        ) from e


@router.patch("/recalcular/{jogo_id}", status_code=status.HTTP_204_NO_CONTENT)
def patch_recalcular_marcadores(
    jogo_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_owner),
) -> None:
    """Recalcula pontuação dos palpites do jogo (inclui bônus de marcadores do Brasil)."""
    try:
        marcador_brasil_service.obter_jogo_que_envolve_brasil(db, jogo_id)
    except ValueError as e:
        auditoria_admin_service.registrar_evento(
            db,
            admin,
            acao="marcadores_brasil.patch_recalcular",
            entidade="marcador_brasil_resultado",
            entidade_id=jogo_id,
            status="error",
            detalhes={"erro": str(e)},
        )
        raise _http_value_error(e) from e
    marcador_brasil_service.recalcular_marcadores_brasil_stub(db, jogo_id)
    auditoria_admin_service.registrar_evento(
        db,
        admin,
        acao="marcadores_brasil.patch_recalcular",
        entidade="marcador_brasil_resultado",
        entidade_id=jogo_id,
    )
