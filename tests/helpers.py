"""Helpers compartilhados nos testes."""

from __future__ import annotations

import re
from unittest.mock import MagicMock


def token_redefinir_senha_do_mock(mock_send: MagicMock) -> str:
    assert mock_send.call_count >= 1
    html = mock_send.call_args.kwargs.get("corpo_html", "")
    match = re.search(r"redefinir-senha\?token=([^\"'&]+)", html)
    assert match, f"Link de redefinição não encontrado no e-mail: {html[:200]}"
    return match.group(1)
