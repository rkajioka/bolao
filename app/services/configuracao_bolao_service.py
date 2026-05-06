"""
Configurações do bolão — leitura mínima para regras transversais (bloqueio de palpites especiais, etc.).

CRUD admin de configurações: etapa futura conforme MD; aqui só leitura para data de bloqueio.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.jogo import Jogo


def get_primeira_configuracao(db: Session) -> ConfiguracaoBolao | None:
    return db.scalar(select(ConfiguracaoBolao).order_by(ConfiguracaoBolao.id.asc()).limit(1))


def get_data_bloqueio_palpites_especiais_efetiva(db: Session) -> datetime | None:
    """
    §10.2: data manual em `configuracoes_bolao`, senão data/hora do primeiro jogo cadastrado.
    Retorna None se não houver config nem jogos (palpites especiais permanecem desbloqueados).
    """
    cfg = get_primeira_configuracao(db)
    if cfg and cfg.data_bloqueio_palpites_especiais is not None:
        return cfg.data_bloqueio_palpites_especiais
    return db.scalar(select(func.min(Jogo.data_jogo)))


def palpites_especiais_esta_bloqueado(db: Session) -> bool:
    ts = get_data_bloqueio_palpites_especiais_efetiva(db)
    if ts is None:
        return False
    agora = datetime.now(UTC)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return agora >= ts
