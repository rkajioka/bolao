"""Assinatura inline (CID) no corpo HTML de todos os e-mails."""

from __future__ import annotations

import pytest

from app.services import email_service


@pytest.fixture(autouse=True)
def _limpar_cache_assinatura():
    email_service._carregar_assinatura_png.cache_clear()
    yield
    email_service._carregar_assinatura_png.cache_clear()


def test_aplicar_assinatura_adiciona_cid_e_quebras(tmp_path, monkeypatch) -> None:
    png = tmp_path / "assinatura.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

    monkeypatch.setattr(email_service, "_resolver_caminho_assinatura", lambda: png)

    corpo = "<p>Conteúdo do e-mail.</p>"
    resultado = email_service._aplicar_assinatura_corpo(corpo)

    assert corpo in resultado
    assert 'src="cid:bolao_assinatura_lpc"' in resultado
    assert "data:image/png;base64," not in resultado
    br_index = resultado.index("<br><br><br>")
    img_index = resultado.index("<img")
    assert br_index < img_index
    assert resultado.endswith("</p>")


def test_aplicar_assinatura_sem_arquivo_retorna_corpo_original(monkeypatch) -> None:
    monkeypatch.setattr(email_service, "_resolver_caminho_assinatura", lambda: None)

    corpo = "<p>Somente o texto principal.</p>"
    assert email_service._aplicar_assinatura_corpo(corpo) == corpo


def test_preparar_corpo_e_anexos_inclui_attachment_inline(tmp_path, monkeypatch) -> None:
    png = tmp_path / "assinatura.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
    monkeypatch.setattr(email_service, "_resolver_caminho_assinatura", lambda: png)

    corpo, anexos = email_service._preparar_corpo_e_anexos("<p>Teste.</p>")

    assert 'cid:bolao_assinatura_lpc' in corpo
    assert len(anexos) == 1
    assert anexos[0]["isInline"] is True
    assert anexos[0]["contentId"] == "bolao_assinatura_lpc"
    assert anexos[0]["contentBytes"]


def test_enviar_email_outlook_aplica_assinatura_no_payload(monkeypatch) -> None:
    captured: dict = {}

    def fake_post(url, headers=None, json=None, timeout=None):  # noqa: ANN001
        captured["payload"] = json
        response = type("R", (), {})()
        response.raise_for_status = lambda: None
        return response

    png_path = email_service._resolver_caminho_assinatura()
    assert png_path is not None and png_path.is_file()

    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    monkeypatch.setattr(email_service, "_obter_token_graph", lambda: "token-test")
    monkeypatch.setattr(
        email_service,
        "_credenciais_outlook",
        lambda: type(
            "S",
            (),
            {
                "graph_api_url": "https://graph.example.com",
                "outlook_sender": "bolao@example.com",
            },
        )(),
    )

    corpo = "<p>Teste de envio.</p>"
    email_service.enviar_email_outlook(
        destinatario="user@example.com",
        assunto="Assunto",
        corpo_html=corpo,
        nome_remetente="Bolão",
    )

    message = captured["payload"]["message"]
    assert corpo in message["body"]["content"]
    assert 'cid:bolao_assinatura_lpc' in message["body"]["content"]
    attachments = message["attachments"]
    assert len(attachments) == 1
    assert attachments[0]["isInline"] is True
    assert attachments[0]["contentId"] == "bolao_assinatura_lpc"
