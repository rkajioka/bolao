"""Fases de mata-mata padronizadas (slug) + normalização para validação e bloqueios."""

from __future__ import annotations

FASES_MATA_MATA_SLUGS: frozenset[str] = frozenset(
    {
        "dezesseis_avos",
        "oitavas",
        "quartas",
        "semi",
        "terceiro_lugar",
        "final",
    }
)

_ALIASES: dict[str, str] = {
    "semifinal": "semi",
    "semi_final": "semi",
    "oitavas_de_final": "oitavas",
    "dezesseis": "dezesseis_avos",
    "3_lugar": "terceiro_lugar",
    "terceiro": "terceiro_lugar",
}


def canonical_fase_mata_mata(raw: str) -> str:
    """Converte texto da API/UI para slug canônico ou levanta ValueError."""
    t = str(raw).strip().lower().replace(" ", "_")
    t = _ALIASES.get(t, t)
    if t not in FASES_MATA_MATA_SLUGS:
        opcoes = ", ".join(sorted(FASES_MATA_MATA_SLUGS))
        raise ValueError(f"Fase de mata-mata inválida; use uma de: {opcoes}")
    return t


def fase_mata_mata_slug_ou_none(raw: str | None) -> str | None:
    """Para bloqueio por fase: reconhece slug canônico e alguns formatos legados."""
    if raw is None or not str(raw).strip():
        return None
    try:
        return canonical_fase_mata_mata(str(raw))
    except ValueError:
        t = str(raw).strip().lower().replace(" ", "_")
        t = _ALIASES.get(t, t)
        if t in FASES_MATA_MATA_SLUGS:
            return t
        return None
