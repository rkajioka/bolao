from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pontuacao_fase import PontuacaoFase
from app.schemas.pontuacao_fase import PontuacaoFaseBulkWrite

DEFAULTS: list[dict[str, int | str]] = [
    {"fase_key": "grupo_rodada_1", "label": "Grupos - Rodada 1", "ordem": 10, "pontos_placar_exato": 10, "pontos_resultado_correto": 5, "pontos_classificado_mata_mata": 0},
    {"fase_key": "grupo_rodada_2", "label": "Grupos - Rodada 2", "ordem": 20, "pontos_placar_exato": 10, "pontos_resultado_correto": 5, "pontos_classificado_mata_mata": 0},
    {"fase_key": "grupo_rodada_3", "label": "Grupos - Rodada 3", "ordem": 30, "pontos_placar_exato": 10, "pontos_resultado_correto": 5, "pontos_classificado_mata_mata": 0},
    {"fase_key": "dezesseis_avos", "label": "32-avos", "ordem": 40, "pontos_placar_exato": 12, "pontos_resultado_correto": 6, "pontos_classificado_mata_mata": 6},
    {"fase_key": "oitavas", "label": "16-avos", "ordem": 50, "pontos_placar_exato": 14, "pontos_resultado_correto": 7, "pontos_classificado_mata_mata": 7},
    {"fase_key": "quartas", "label": "Quartas", "ordem": 60, "pontos_placar_exato": 16, "pontos_resultado_correto": 8, "pontos_classificado_mata_mata": 8},
    {"fase_key": "semi", "label": "Semifinal", "ordem": 70, "pontos_placar_exato": 18, "pontos_resultado_correto": 9, "pontos_classificado_mata_mata": 9},
    {"fase_key": "terceiro_lugar", "label": "Disputa 3º", "ordem": 80, "pontos_placar_exato": 20, "pontos_resultado_correto": 10, "pontos_classificado_mata_mata": 10},
    {"fase_key": "final", "label": "Final", "ordem": 90, "pontos_placar_exato": 24, "pontos_resultado_correto": 12, "pontos_classificado_mata_mata": 12},
]


def listar_empresa(db: Session, empresa_id: int) -> list[PontuacaoFase]:
    return list(
        db.scalars(
            select(PontuacaoFase)
            .where(PontuacaoFase.empresa_id == empresa_id)
            .order_by(PontuacaoFase.ordem.asc(), PontuacaoFase.id.asc())
        ).all()
    )


def ensure_defaults_empresa(db: Session, empresa_id: int) -> list[PontuacaoFase]:
    atuais = {x.fase_key: x for x in listar_empresa(db, empresa_id)}
    changed = False
    for item in DEFAULTS:
        key = str(item["fase_key"])
        if key in atuais:
            continue
        db.add(
            PontuacaoFase(
                empresa_id=empresa_id,
                fase_key=key,
                label=str(item["label"]),
                ordem=int(item["ordem"]),
                pontos_placar_exato=int(item["pontos_placar_exato"]),
                pontos_resultado_correto=int(item["pontos_resultado_correto"]),
                pontos_classificado_mata_mata=int(item["pontos_classificado_mata_mata"]),
            )
        )
        changed = True
    if changed:
        db.commit()
    return listar_empresa(db, empresa_id)


def substituir_todos_empresa(
    db: Session, empresa_id: int, payload: PontuacaoFaseBulkWrite
) -> list[PontuacaoFase]:
    atuais = {x.fase_key: x for x in listar_empresa(db, empresa_id)}
    payload_keys = {i.fase_key for i in payload.itens}
    default_keys = {str(d["fase_key"]) for d in DEFAULTS}
    if payload_keys != default_keys:
        faltando = sorted(default_keys - payload_keys)
        extras = sorted(payload_keys - default_keys)
        msg = []
        if faltando:
            msg.append(f"faltando: {', '.join(faltando)}")
        if extras:
            msg.append(f"extras: {', '.join(extras)}")
        raise ValueError("Payload de pontuação por fase inválido (" + "; ".join(msg) + ")")

    for item in payload.itens:
        row = atuais.get(item.fase_key)
        if row is None:
            row = PontuacaoFase(empresa_id=empresa_id, fase_key=item.fase_key)
            db.add(row)
        row.label = item.label
        row.ordem = item.ordem
        row.pontos_placar_exato = item.pontos_placar_exato
        row.pontos_resultado_correto = item.pontos_resultado_correto
        row.pontos_classificado_mata_mata = item.pontos_classificado_mata_mata
    db.commit()
    return listar_empresa(db, empresa_id)


def get_por_fase_key_empresa(db: Session, empresa_id: int, fase_key: str) -> PontuacaoFase | None:
    return db.scalar(
        select(PontuacaoFase).where(
            PontuacaoFase.empresa_id == empresa_id,
            PontuacaoFase.fase_key == fase_key,
        )
    )
