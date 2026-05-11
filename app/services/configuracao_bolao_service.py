"""
Configurações do bolão por empresa.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.jogo import Jogo
from app.schemas.configuracao_bolao import ConfiguracaoBolaoWrite


def get_configuracao_empresa(db: Session, empresa_id: int) -> ConfiguracaoBolao | None:
    return db.scalar(
        select(ConfiguracaoBolao).where(ConfiguracaoBolao.empresa_id == empresa_id).limit(1)
    )


def ensure_configuracao_empresa(db: Session, empresa_id: int) -> ConfiguracaoBolao:
    c = get_configuracao_empresa(db, empresa_id)
    if c is not None:
        return c
    c = ConfiguracaoBolao(
        empresa_id=empresa_id,
        data_bloqueio_palpites_especiais=None,
        pontos_campeao=35,
        pontos_vice_campeao=25,
        pontos_terceiro_lugar=20,
        pontos_artilheiro_pais=20,
        pontos_placar_exato=18,
        pontos_resultado_correto=10,
        pontos_classificado_mata_mata=12,
        pontos_marcador_brasil=4,
        pontos_marcador_brasil_com_quantidade=4,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def atualizar_configuracao_empresa(
    db: Session, empresa_id: int, data: ConfiguracaoBolaoWrite
) -> ConfiguracaoBolao:
    c = ensure_configuracao_empresa(db, empresa_id)
    c.data_bloqueio_palpites_especiais = data.data_bloqueio_palpites_especiais
    c.pontos_campeao = data.pontos_campeao
    c.pontos_vice_campeao = data.pontos_vice_campeao
    c.pontos_terceiro_lugar = data.pontos_terceiro_lugar
    c.pontos_artilheiro_pais = data.pontos_artilheiro_pais
    c.pontos_placar_exato = data.pontos_placar_exato
    c.pontos_resultado_correto = data.pontos_resultado_correto
    c.pontos_classificado_mata_mata = data.pontos_classificado_mata_mata
    c.pontos_marcador_brasil = data.pontos_marcador_brasil
    c.pontos_marcador_brasil_com_quantidade = data.pontos_marcador_brasil_com_quantidade
    db.commit()
    db.refresh(c)
    return c


def get_data_bloqueio_palpites_especiais_efetiva(db: Session, empresa_id: int) -> datetime | None:
    cfg = get_configuracao_empresa(db, empresa_id)
    if cfg and cfg.data_bloqueio_palpites_especiais is not None:
        return cfg.data_bloqueio_palpites_especiais
    return db.scalar(
        select(func.min(Jogo.data_jogo)).where(
            Jogo.tipo_fase == "grupos",
            Jogo.rodada == 1,
        )
    )


def palpites_especiais_esta_bloqueado(db: Session, empresa_id: int) -> bool:
    ts = get_data_bloqueio_palpites_especiais_efetiva(db, empresa_id)
    if ts is None:
        return False
    agora = datetime.now(UTC)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return agora >= ts
