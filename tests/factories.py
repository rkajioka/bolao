"""Fábricas mínimas para testes de integração (Etapa 13)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.jogo import Jogo
from app.models.pais import Pais
from app.schemas.jogo import JogoCreate, JogoResultadoPatch
from app.schemas.pais import PaisCreate
from app.schemas.usuario import UsuarioCreate
from app.services import jogo_service, pais_service, usuario_service


def seed_config_com_bloqueio_especiais(db: Session) -> ConfiguracaoBolao:
    c = ConfiguracaoBolao(
        data_bloqueio_palpites_especiais=datetime.now(UTC) - timedelta(hours=1),
        pontos_campeao=10,
        pontos_melhor_jogador=5,
        pontos_artilheiro=5,
        pontos_melhor_goleiro=5,
        pontos_placar_exato=10,
        pontos_resultado_correto=5,
        pontos_classificado_mata_mata=7,
        pontos_marcador_brasil=2,
        pontos_marcador_brasil_com_quantidade=2,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def seed_config(db: Session) -> ConfiguracaoBolao:
    c = ConfiguracaoBolao(
        data_bloqueio_palpites_especiais=None,
        pontos_campeao=10,
        pontos_melhor_jogador=5,
        pontos_artilheiro=5,
        pontos_melhor_goleiro=5,
        pontos_placar_exato=10,
        pontos_resultado_correto=5,
        pontos_classificado_mata_mata=7,
        pontos_marcador_brasil=2,
        pontos_marcador_brasil_com_quantidade=2,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def seed_admin_e_usuario(db: Session) -> tuple[int, int]:
    admin = usuario_service.create_usuario(
        db,
        UsuarioCreate(
            nome="Admin Teste",
            email="admin-etapa13@example.com",
            senha_plana="senhaadmin1",
            funcao="Admin",
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
        ),
    )
    user = usuario_service.create_usuario(
        db,
        UsuarioCreate(
            nome="Usuário Teste",
            email="user-etapa13@example.com",
            senha_plana="senhausuario1",
            funcao="Jogador",
            tipo_usuario="usuario",
            ativo=True,
            primeiro_login=False,
        ),
    )
    return admin.id, user.id


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
    j = jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="oitavas",
            grupo=None,
            tipo_fase="mata_mata",
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) + timedelta(days=3),
        ),
    )
    return j


def finalizar_jogo_grupo(db: Session, jogo: Jogo, casa: int, fora: int) -> Jogo:
    jogo_service.patch_resultado(db, jogo, JogoResultadoPatch(placar_casa=casa, placar_fora=fora))
    db.refresh(jogo)
    return jogo_service.patch_finalizar(db, jogo)


def finalizar_jogo_mata_mata_com_penaltis(
    db: Session, jogo: Jogo, placar_casa: int, placar_fora: int, classificado_id: int
) -> Jogo:
    jogo_service.patch_resultado(
        db,
        jogo,
        JogoResultadoPatch(
            placar_casa=placar_casa,
            placar_fora=placar_fora,
            teve_prorrogacao=True,
            foi_para_penaltis=True,
            penaltis_casa=4,
            penaltis_fora=5,
            classificado_id=classificado_id,
        ),
    )
    db.refresh(jogo)
    return jogo_service.patch_finalizar(db, jogo)
