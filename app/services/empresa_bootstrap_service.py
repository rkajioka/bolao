from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.empresa_tema import EmpresaTema
from app.services import pontuacao_fase_service
from app.theme_defaults import DEFAULT_THEME_TOKENS_DARK, DEFAULT_THEME_TOKENS_LIGHT


def bootstrap_empresa_defaults(db: Session, empresa_id: int) -> None:
    existing_cfg = db.scalar(
        select(ConfiguracaoBolao).where(ConfiguracaoBolao.empresa_id == empresa_id).limit(1)
    )
    if existing_cfg is None:
        db.add(
            ConfiguracaoBolao(
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
        )

    pontuacao_fase_service.ensure_defaults_empresa(db, empresa_id)

    existing_tema = db.scalar(
        select(EmpresaTema).where(EmpresaTema.empresa_id == empresa_id).limit(1)
    )
    if existing_tema is None:
        db.add(
            EmpresaTema(
                empresa_id=empresa_id,
                tokens_dark=dict(DEFAULT_THEME_TOKENS_DARK),
                tokens_light=dict(DEFAULT_THEME_TOKENS_LIGHT),
            )
        )
    db.commit()
