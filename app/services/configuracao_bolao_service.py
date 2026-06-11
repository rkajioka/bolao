"""
Configurações do bolão por empresa.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.jogo import Jogo
from app.schemas.configuracao_bolao import ConfiguracaoBolaoRead, ConfiguracaoBolaoWrite
from app.services import empresa_service
from app.services.regra_negocio import assert_pontuacao_editavel_empresa

_MODO_PARA_OVERRIDE: dict[str, bool | None] = {
    "automatico": None,
    "travado": True,
    "destravado": False,
}


def get_configuracao_empresa(db: Session, empresa_id: int) -> ConfiguracaoBolao | None:
    return db.scalar(
        select(ConfiguracaoBolao).where(ConfiguracaoBolao.empresa_id == empresa_id).limit(1)
    )


def configuracao_para_read(db: Session, config: ConfiguracaoBolao) -> ConfiguracaoBolaoRead:
    attrs = {
        name: getattr(config, name)
        for name in ConfiguracaoBolaoRead.model_fields
        if name
        not in {
            "marcadores_brasil_habilitado",
            "data_bloqueio_palpites_especiais_efetiva",
            "palpites_especiais_bloqueados",
        }
        and hasattr(config, name)
    }
    attrs["marcadores_brasil_habilitado"] = empresa_service.marcadores_brasil_habilitado(
        db, config.empresa_id
    )
    attrs["data_bloqueio_palpites_especiais_efetiva"] = get_data_bloqueio_palpites_especiais_efetiva(
        db, config.empresa_id
    )
    attrs["palpites_especiais_bloqueados"] = palpites_especiais_esta_bloqueado(db, config.empresa_id)
    return ConfiguracaoBolaoRead(**attrs)


def ensure_configuracao_empresa(db: Session, empresa_id: int) -> ConfiguracaoBolao:
    c = get_configuracao_empresa(db, empresa_id)
    if c is not None:
        return c
    c = ConfiguracaoBolao(
        empresa_id=empresa_id,
        data_bloqueio_palpites_especiais=None,
        override_bloqueio_palpites_especiais=None,
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


def _pontos_alterados(c: ConfiguracaoBolao, data: ConfiguracaoBolaoWrite) -> bool:
    campos = (
        "pontos_campeao",
        "pontos_vice_campeao",
        "pontos_terceiro_lugar",
        "pontos_artilheiro_pais",
        "pontos_placar_exato",
        "pontos_resultado_correto",
        "pontos_classificado_mata_mata",
    )
    if any(getattr(c, field) != getattr(data, field) for field in campos):
        return True
    if data.pontos_marcador_brasil is not None and c.pontos_marcador_brasil != data.pontos_marcador_brasil:
        return True
    if (
        data.pontos_marcador_brasil_com_quantidade is not None
        and c.pontos_marcador_brasil_com_quantidade != data.pontos_marcador_brasil_com_quantidade
    ):
        return True
    return False


def atualizar_configuracao_empresa(
    db: Session, empresa_id: int, data: ConfiguracaoBolaoWrite
) -> ConfiguracaoBolao:
    c = ensure_configuracao_empresa(db, empresa_id)
    if _pontos_alterados(c, data):
        assert_pontuacao_editavel_empresa(db, empresa_id)
    c.data_bloqueio_palpites_especiais = data.data_bloqueio_palpites_especiais
    c.pontos_campeao = data.pontos_campeao
    c.pontos_vice_campeao = data.pontos_vice_campeao
    c.pontos_terceiro_lugar = data.pontos_terceiro_lugar
    c.pontos_artilheiro_pais = data.pontos_artilheiro_pais
    c.pontos_placar_exato = data.pontos_placar_exato
    c.pontos_resultado_correto = data.pontos_resultado_correto
    c.pontos_classificado_mata_mata = data.pontos_classificado_mata_mata
    if empresa_service.marcadores_brasil_habilitado(db, empresa_id):
        if data.pontos_marcador_brasil is not None:
            c.pontos_marcador_brasil = data.pontos_marcador_brasil
        if data.pontos_marcador_brasil_com_quantidade is not None:
            c.pontos_marcador_brasil_com_quantidade = data.pontos_marcador_brasil_com_quantidade
    db.commit()
    db.refresh(c)
    return c


def get_data_bloqueio_palpites_especiais_efetiva(db: Session, empresa_id: int) -> datetime | None:
    """Data efetiva de bloqueio dos palpites especiais do tenant.

    Usa a data configurada na empresa quando existir; caso contrário, aplica fallback
    global: início do primeiro jogo de grupos da rodada 1 no calendário do owner.
    Alterações na agenda global portanto afetam tenants sem data própria.
    """
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
    cfg = get_configuracao_empresa(db, empresa_id)
    if cfg is None:
        return False
    override = cfg.override_bloqueio_palpites_especiais
    if override is True:
        return True
    if override is False:
        return False
    ts = get_data_bloqueio_palpites_especiais_efetiva(db, empresa_id)
    if ts is None:
        return False
    agora = datetime.now(UTC)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return agora >= ts


def definir_override_bloqueio_palpites_especiais(
    db: Session,
    empresa_id: int,
    modo: Literal["automatico", "travado", "destravado"],
) -> ConfiguracaoBolao:
    c = ensure_configuracao_empresa(db, empresa_id)
    c.override_bloqueio_palpites_especiais = _MODO_PARA_OVERRIDE[modo]
    db.commit()
    db.refresh(c)
    return c
