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
from app.schemas.configuracao_bolao import ConfiguracaoBolaoWrite


def get_primeira_configuracao(db: Session) -> ConfiguracaoBolao | None:
    return db.scalar(select(ConfiguracaoBolao).order_by(ConfiguracaoBolao.id.asc()).limit(1))


def ensure_primeira_configuracao(db: Session) -> ConfiguracaoBolao:
    """Garante uma linha em configuracoes_bolao (defaults alinhados ao seed)."""
    c = get_primeira_configuracao(db)
    if c is not None:
        return c
    c = ConfiguracaoBolao(
        data_bloqueio_palpites_especiais=None,
        pontos_campeao=25,
        pontos_melhor_jogador=10,
        pontos_artilheiro=10,
        pontos_melhor_goleiro=10,
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


def atualizar_configuracao(db: Session, data: ConfiguracaoBolaoWrite) -> ConfiguracaoBolao:
    c = ensure_primeira_configuracao(db)
    c.data_bloqueio_palpites_especiais = data.data_bloqueio_palpites_especiais
    c.pontos_campeao = data.pontos_campeao
    c.pontos_melhor_jogador = data.pontos_melhor_jogador
    c.pontos_artilheiro = data.pontos_artilheiro
    c.pontos_melhor_goleiro = data.pontos_melhor_goleiro
    c.pontos_placar_exato = data.pontos_placar_exato
    c.pontos_resultado_correto = data.pontos_resultado_correto
    c.pontos_classificado_mata_mata = data.pontos_classificado_mata_mata
    c.pontos_marcador_brasil = data.pontos_marcador_brasil
    c.pontos_marcador_brasil_com_quantidade = data.pontos_marcador_brasil_com_quantidade
    db.commit()
    db.refresh(c)
    return c


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
