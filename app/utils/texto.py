"""Normalização de textos para comparação de palpites (§10.4, §11.7)."""

from __future__ import annotations

import unicodedata


def normalizar_texto_palpite(valor: str | None) -> str:
    if not valor or not str(valor).strip():
        return ""
    t = " ".join(str(valor).strip().split()).lower()
    nfkd = unicodedata.normalize("NFKD", t)
    return "".join(ch for ch in nfkd if unicodedata.category(ch) != "Mn")
