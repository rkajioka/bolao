"""
Regras compartilhadas de prazo, finalização e congelamento de pontuação.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.jogo import Jogo
from app.models.palpite_jogo import PalpiteJogo
from app.models.usuario import Usuario


class ConflitoRegraNegocioError(Exception):
    """Estado inválido para a operação — mapear para HTTP 409."""


def agora_utc() -> datetime:
    return datetime.now(UTC)


def assert_jogo_nao_finalizado(jogo: Jogo) -> None:
    if jogo.finalizado:
        raise ConflitoRegraNegocioError("O jogo está finalizado e não pode ser alterado")


def assert_palpite_aberto(db: Session, jogo: Jogo, *, agora: datetime | None = None) -> None:
    if jogo.finalizado:
        raise ConflitoRegraNegocioError("O jogo está finalizado; o palpite não pode ser alterado")
    from app.services import jogo_service

    instante = agora or agora_utc()
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=UTC)
    limite = jogo_service.momento_fim_edicao_palpite(db, jogo)
    if limite.tzinfo is None:
        limite = limite.replace(tzinfo=UTC)
    if instante >= limite:
        raise ConflitoRegraNegocioError(
            "O palpite não pode ser alterado: prazo encerrado (1h antes do primeiro jogo "
            "da mesma rodada ou da mesma fase de mata-mata) ou o jogo já começou"
        )


def obter_jogo_para_edicao_palpite(db: Session, jogo_id: int) -> Jogo:
    jogo = db.get(Jogo, jogo_id, with_for_update=True)
    if jogo is None:
        raise ValueError("Jogo não encontrado")
    return jogo


def empresa_tem_jogo_finalizado(db: Session, empresa_id: int) -> bool:
    stmt = (
        select(Jogo.id)
        .join(PalpiteJogo, PalpiteJogo.jogo_id == Jogo.id)
        .join(Usuario, Usuario.id == PalpiteJogo.usuario_id)
        .where(Jogo.finalizado.is_(True), Usuario.empresa_id == empresa_id)
        .limit(1)
    )
    return db.scalar(stmt) is not None


def assert_pontuacao_editavel_empresa(db: Session, empresa_id: int) -> None:
    if empresa_tem_jogo_finalizado(db, empresa_id):
        raise ConflitoRegraNegocioError(
            "A pontuação da empresa não pode ser alterada após jogos finalizados"
        )
