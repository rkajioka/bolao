"""Fábricas mínimas para testes de integração (Etapa 13)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.empresa import Empresa
from app.models.jogo import Jogo
from app.models.pais import Pais
from app.schemas.empresa import EmpresaCreate
from app.schemas.jogo import JogoCreate, JogoResultadoPatch
from app.schemas.pais import PaisCreate
from app.schemas.usuario import UsuarioCreate
from app.services import empresa_service, jogo_service, pais_service, pontuacao_fase_service, usuario_service


def seed_empresa(db: Session, codigo: str = "TESTE") -> Empresa:
    return empresa_service.create_empresa(
        db,
        EmpresaCreate(
            nome="Empresa Teste",
            codigo_empresa=codigo,
            marcadores_brasil_habilitado=True,
            max_usuarios=100,
        ),
    )


def seed_config_com_bloqueio_especiais(db: Session, empresa_id: int) -> ConfiguracaoBolao:
    from app.services import configuracao_bolao_service

    c = configuracao_bolao_service.ensure_configuracao_empresa(db, empresa_id)
    c.data_bloqueio_palpites_especiais = datetime.now(UTC) - timedelta(hours=1)
    db.commit()
    db.refresh(c)
    return c


def seed_config(db: Session, empresa_id: int) -> ConfiguracaoBolao:
    c = ConfiguracaoBolao(
        empresa_id=empresa_id,
        data_bloqueio_palpites_especiais=None,
        pontos_campeao=10,
        pontos_vice_campeao=7,
        pontos_terceiro_lugar=6,
        pontos_artilheiro_pais=5,
        pontos_placar_exato=10,
        pontos_resultado_correto=5,
        pontos_classificado_mata_mata=7,
        pontos_marcador_brasil=2,
        pontos_marcador_brasil_com_quantidade=2,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    pontuacao_fase_service.ensure_defaults_empresa(db, empresa_id)
    return c


def seed_owner_admin_e_usuario(db: Session) -> tuple[int, int, int]:
    empresa = seed_empresa(db)
    owner, _ = usuario_service.create_usuario(
        db,
        UsuarioCreate.model_construct(
            nome="Owner Teste",
            email="owner-etapa13@example.com",
            senha_plana="senhaowner1",
            funcao="Owner",
            tipo_usuario="owner",
            ativo=True,
            primeiro_login=False,
        ),
    )
    admin, _ = usuario_service.create_usuario(
        db,
        UsuarioCreate.model_construct(
            nome="Admin Teste",
            email="admin-etapa13@example.com",
            senha_plana="senhaadmin1",
            funcao="Admin",
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=empresa.id,
        ),
    )
    user, _ = usuario_service.create_usuario(
        db,
        UsuarioCreate.model_construct(
            nome="Usuário Teste",
            email="user-etapa13@example.com",
            senha_plana="senhausuario1",
            funcao="Jogador",
            tipo_usuario="usuario",
            ativo=True,
            primeiro_login=False,
            empresa_id=empresa.id,
        ),
    )
    return owner.id, admin.id, user.id


def seed_admin_e_usuario(db: Session) -> tuple[int, int]:
    _, admin_id, user_id = seed_owner_admin_e_usuario(db)
    return admin_id, user_id


def seed_brasil_e_adversario(db: Session) -> tuple[int, int]:
    br = pais_service.create_pais(
        db,
        PaisCreate(nome="Brasil", sigla="BR", bandeira_url="https://example.com/br.png", grupo="A"),
    )
    adv = pais_service.create_pais(
        db,
        PaisCreate(nome="Time B", sigla="TB", bandeira_url="https://example.com/b.png", grupo="A"),
    )
    return br.id, adv.id


def seed_jogo_brasil_em_breve(db: Session, brasil_id: int, fora_id: int) -> Jogo:
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Grupo A",
            grupo="A",
            tipo_fase="grupos",
            rodada=1,
            pais_casa_id=brasil_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) + timedelta(days=2),
        ),
    )


def seed_dois_paises(db: Session) -> tuple[int, int]:
    a = pais_service.create_pais(
        db,
        PaisCreate(nome="Time A", sigla="TA", bandeira_url="https://example.com/a.png", grupo="A"),
    )
    b = pais_service.create_pais(
        db,
        PaisCreate(nome="Time B", sigla="TB", bandeira_url="https://example.com/b.png", grupo="A"),
    )
    return a.id, b.id


def seed_jogo_grupo_em_breve(db: Session, casa_id: int, fora_id: int) -> Jogo:
    """Jogo daqui a 2 dias — palpite ainda editável."""
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Grupo X",
            grupo="X",
            tipo_fase="grupos",
            rodada=1,
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) + timedelta(days=2),
        ),
    )


def seed_jogo_grupo_iniciado_ha_horas(
    db: Session,
    casa_id: int,
    fora_id: int,
    horas: float = 3,
) -> Jogo:
    """Jogo já iniciado há algumas horas — permite finalização oficial."""
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Grupo Z",
            grupo="Z",
            tipo_fase="grupos",
            rodada=1,
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) - timedelta(hours=horas),
        ),
    )


def seed_jogo_grupo_passado(db: Session, casa_id: int, fora_id: int) -> Jogo:
    """Jogo ontem — palpite bloqueado por horário."""
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Grupo Y",
            grupo="Y",
            tipo_fase="grupos",
            rodada=1,
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) - timedelta(days=1),
        ),
    )


def seed_jogo_mata_mata(db: Session, casa_id: int, fora_id: int) -> Jogo:
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Oitavas",
            grupo=None,
            tipo_fase="mata_mata",
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) + timedelta(days=3),
        ),
    )


def _backdate_jogo_para_finalizacao(db: Session, jogo: Jogo, horas_desde_inicio: float = 3) -> Jogo:
    jogo.data_jogo = datetime.now(UTC) - timedelta(hours=horas_desde_inicio)
    db.commit()
    db.refresh(jogo)
    return jogo


def finalizar_jogo(db: Session, jogo: Jogo, casa: int, fora: int) -> Jogo:
    jogo = jogo_service.patch_resultado(
        db,
        jogo,
        JogoResultadoPatch(placar_casa=casa, placar_fora=fora),
    )
    jogo = _backdate_jogo_para_finalizacao(db, jogo)
    return jogo_service.patch_finalizar(db, jogo)


def finalizar_jogo_mata_mata_com_penaltis(
    db: Session,
    jogo: Jogo,
    casa: int,
    fora: int,
    classificado_id: int,
) -> Jogo:
    jogo = jogo_service.patch_resultado(
        db,
        jogo,
        JogoResultadoPatch(
            placar_casa=casa,
            placar_fora=fora,
            teve_prorrogacao=True,
            foi_para_penaltis=True,
            penaltis_casa=4,
            penaltis_fora=5,
            classificado_id=classificado_id,
        ),
    )
    jogo = _backdate_jogo_para_finalizacao(db, jogo)
    return jogo_service.patch_finalizar(db, jogo)
