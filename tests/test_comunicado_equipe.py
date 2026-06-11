from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.auth.password import hash_password
from app.core.config import get_settings
from app.database import SessionLocal
from app.models.empresa import Empresa
from app.models.usuario import Usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _seed_empresa_com_membros(db) -> tuple[Empresa, Usuario, list[Usuario]]:
    emp = Empresa(nome="Empresa Comunicado", codigo_empresa="emp-com-1", ativo=True, max_usuarios=50)
    db.add(emp)
    db.commit()
    db.refresh(emp)

    admin = Usuario(
        nome="Admin",
        email="admin-com@example.com",
        senha_hash=hash_password("senhaadmin1"),
        tipo_usuario="admin",
        ativo=True,
        primeiro_login=False,
        bloqueado=False,
        empresa_id=emp.id,
    )
    ativo1 = Usuario(
        nome="Ativo 1",
        email="ativo1@example.com",
        senha_hash=hash_password("senhaativa11"),
        tipo_usuario="usuario",
        ativo=True,
        primeiro_login=False,
        bloqueado=False,
        empresa_id=emp.id,
    )
    ativo2 = Usuario(
        nome="Ativo 2",
        email="ativo2@example.com",
        senha_hash=hash_password("senhaativa22"),
        tipo_usuario="usuario",
        ativo=True,
        primeiro_login=False,
        bloqueado=False,
        empresa_id=emp.id,
    )
    aguardando = Usuario(
        nome="Aguardando",
        email="aguardando@example.com",
        senha_hash=hash_password("senhaaguard1"),
        tipo_usuario="usuario",
        ativo=True,
        primeiro_login=True,
        bloqueado=False,
        empresa_id=emp.id,
    )
    bloqueado = Usuario(
        nome="Bloqueado",
        email="bloqueado@example.com",
        senha_hash=hash_password("senhabloq123"),
        tipo_usuario="usuario",
        ativo=True,
        primeiro_login=False,
        bloqueado=True,
        empresa_id=emp.id,
    )
    db.add_all([admin, ativo1, ativo2, aguardando, bloqueado])
    db.commit()
    db.refresh(admin)
    return emp, admin, [ativo1, ativo2, aguardando, bloqueado]


def _headers_admin(client) -> dict[str, str]:
    db = SessionLocal()
    try:
        _, admin, _ = _seed_empresa_com_membros(db)
        token = _login(client, admin.email, "senhaadmin1")
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def test_preview_comunicado_modo_teste(client) -> None:
    headers = _headers_admin(client)
    r = client.get("/equipe/comunicado/preview", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_destinatarios"] == 1
    assert body["modo_teste"] is True


@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_comunicado_async",
    new_callable=AsyncMock,
)
def test_post_comunicado_modo_teste(mock_enviar, client) -> None:
    mock_enviar.return_value = type("R", (), {"sucesso": True, "erro": None})()
    headers = _headers_admin(client)
    payload = {"assunto": "Lembrete", "mensagem": "Não esqueça os palpites."}

    r = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["total_destinatarios"] == 1
    assert body["modo_teste"] is True
    assert body["enfileirado"] is True


@pytest.mark.parametrize(
    "payload",
    [
        {"mensagem": "só mensagem"},
        {"assunto": "só assunto"},
        {"assunto": "   ", "mensagem": "texto"},
        {"assunto": "ok", "mensagem": "   "},
    ],
)
def test_post_comunicado_validacao_obrigatoria(client, payload) -> None:
    headers = _headers_admin(client)
    r = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r.status_code == 422


@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_comunicado_async",
    new_callable=AsyncMock,
)
def test_post_comunicado_rate_limit(mock_enviar, client, monkeypatch) -> None:
    mock_enviar.return_value = type("R", (), {"sucesso": True, "erro": None})()
    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limit_comunicado_equipe_requests", 1)
    headers = _headers_admin(client)
    payload = {"assunto": "A", "mensagem": "B"}

    r1 = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r1.status_code == 201, r1.text

    r2 = client.post("/equipe/comunicado", headers=headers, json={"assunto": "C", "mensagem": "D"})
    assert r2.status_code == 429, r2.text


@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_comunicado_async",
    new_callable=AsyncMock,
)
def test_post_comunicado_escapa_html(mock_enviar, client) -> None:
    mock_enviar.return_value = type("R", (), {"sucesso": True, "erro": None})()
    headers = _headers_admin(client)
    payload = {
        "assunto": "Aviso",
        "mensagem": "<script>alert(1)</script>",
    }

    r = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r.status_code == 201, r.text

    from app.services import email_service

    html_fn = email_service._mensagem_texto_para_html
    assert "<script>" not in html_fn("<script>alert(1)</script>")
    assert "&lt;script&gt;" in html_fn("<script>alert(1)</script>")


def test_preview_comunicado_producao(client) -> None:
    headers = _headers_admin(client)
    r = client.get("/equipe/comunicado/preview?modo_teste=false", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_destinatarios"] == 3
    assert body["modo_teste"] is False


@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_comunicado_async",
    new_callable=AsyncMock,
)
def test_post_comunicado_producao_destinatarios(mock_enviar, client) -> None:
    mock_enviar.return_value = type("R", (), {"sucesso": True, "erro": None})()
    headers = _headers_admin(client)
    payload = {
        "assunto": "Aviso geral",
        "mensagem": "Mensagem para todos.",
        "modo_teste": False,
    }

    r = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    assert r.json()["total_destinatarios"] == 3


def test_producao_exclui_primeiro_login_e_bloqueado(client) -> None:
    from app.services import comunicado_equipe_service

    db = SessionLocal()
    try:
        _, admin, membros = _seed_empresa_com_membros(db)
        emails = comunicado_equipe_service.resolver_destinatarios_comunicado(
            db, admin.empresa_id, admin, modo_teste=False
        )
    finally:
        db.close()

    assert "admin-com@example.com" in emails
    assert "ativo1@example.com" in emails
    assert "ativo2@example.com" in emails
    assert "aguardando@example.com" not in emails
    assert "bloqueado@example.com" not in emails
    assert len(emails) == 3
    del membros


def test_post_comunicado_producao_sem_destinatarios(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Vazia", codigo_empresa="emp-vazia", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Solo",
            email="admin-solo@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=True,
            bloqueado=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        token = _login(client, admin.email, "senhaadmin1")
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    r_preview = client.get("/equipe/comunicado/preview?modo_teste=false", headers=headers)
    assert r_preview.status_code == 200
    assert r_preview.json()["total_destinatarios"] == 0

    r_post = client.post(
        "/equipe/comunicado",
        headers=headers,
        json={"assunto": "Teste", "mensagem": "Teste", "modo_teste": False},
    )
    assert r_post.status_code == 400, r_post.text


@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_resumo_comunicado_admin_async",
    new_callable=AsyncMock,
)
@patch(
    "app.services.comunicado_equipe_service.email_service.tentar_enviar_comunicado_async",
    new_callable=AsyncMock,
)
def test_comunicado_envia_resumo_ao_admin_ao_concluir(mock_enviar, mock_resumo, client) -> None:
    mock_enviar.return_value = type("R", (), {"sucesso": True, "erro": None})()
    mock_resumo.return_value = type("R", (), {"sucesso": True, "erro": None})()
    headers = _headers_admin(client)
    payload = {"assunto": "Lembrete", "mensagem": "Texto do aviso."}

    r = client.post("/equipe/comunicado", headers=headers, json=payload)
    assert r.status_code == 201, r.text

    mock_resumo.assert_awaited_once()
    args, kwargs = mock_resumo.await_args
    assert args[0] == "admin-com@example.com"
    assert args[2] == "Lembrete"
    assert kwargs["total"] == 1
    assert kwargs["enviados"] == 1
    assert kwargs["falhas"] == 0
