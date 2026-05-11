from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.empresa_tema import EmpresaTema
from app.models.plataforma_tema import PlataformaTema
from app.theme_defaults import (
    ALLOWED_THEME_TOKEN_KEYS,
    DEFAULT_THEME_TOKENS_DARK,
    DEFAULT_THEME_TOKENS_LIGHT,
)

_COLOR_PATTERN = re.compile(
    r"^(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$"
)


def _validate_tokens(tokens: dict[str, str]) -> dict[str, str]:
    unknown = set(tokens.keys()) - ALLOWED_THEME_TOKEN_KEYS
    if unknown:
        raise ValueError(f"Tokens de tema inválidos: {', '.join(sorted(unknown))}")
    out: dict[str, str] = {}
    for key in ALLOWED_THEME_TOKEN_KEYS:
        value = tokens.get(key)
        if value is None:
            raise ValueError(f"Token obrigatório ausente: {key}")
        value = str(value).strip()
        if not _COLOR_PATTERN.match(value):
            raise ValueError(f"Cor inválida para {key}")
        out[key] = value
    return out


def ensure_plataforma_tema(db: Session) -> PlataformaTema:
    row = db.scalar(select(PlataformaTema).order_by(PlataformaTema.id.asc()).limit(1))
    if row is not None:
        return row
    row = PlataformaTema(
        tokens_dark=dict(DEFAULT_THEME_TOKENS_DARK),
        tokens_light=dict(DEFAULT_THEME_TOKENS_LIGHT),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_plataforma_tema(db: Session) -> PlataformaTema:
    return ensure_plataforma_tema(db)


def atualizar_plataforma_tema(db: Session, tokens_dark: dict[str, str], tokens_light: dict[str, str]) -> PlataformaTema:
    row = ensure_plataforma_tema(db)
    row.tokens_dark = _validate_tokens(tokens_dark)
    row.tokens_light = _validate_tokens(tokens_light)
    db.commit()
    db.refresh(row)
    return row


def ensure_empresa_tema(db: Session, empresa_id: int) -> EmpresaTema:
    row = db.scalar(select(EmpresaTema).where(EmpresaTema.empresa_id == empresa_id).limit(1))
    if row is not None:
        return row
    row = EmpresaTema(
        empresa_id=empresa_id,
        tokens_dark=dict(DEFAULT_THEME_TOKENS_DARK),
        tokens_light=dict(DEFAULT_THEME_TOKENS_LIGHT),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_empresa_tema(db: Session, empresa_id: int) -> EmpresaTema:
    return ensure_empresa_tema(db, empresa_id)


def atualizar_empresa_tema(
    db: Session, empresa_id: int, tokens_dark: dict[str, str], tokens_light: dict[str, str]
) -> EmpresaTema:
    row = ensure_empresa_tema(db, empresa_id)
    row.tokens_dark = _validate_tokens(tokens_dark)
    row.tokens_light = _validate_tokens(tokens_light)
    db.commit()
    db.refresh(row)
    return row
