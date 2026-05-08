"""Resend: convite e reset — credenciais no BD; mock da API."""

from __future__ import annotations

from unittest.mock import patch

from app.database import SessionLocal
from app.models.configuracao_email import ConfiguracaoEmail
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.convite import BulkConviteRequest
from app.schemas.usuario import UsuarioCreate
from app.services import convite_service, usuario_service


def _seed_admin_com_empresa(db) -> tuple[Usuario, Empresa]:
    emp = Empresa(nome="Empresa Teste", codigo_empresa="emp-email-1", ativo=True)
    db.add(emp)
    db.commit()
    db.refresh(emp)
    admin = usuario_service.create_usuario(
        db,
        UsuarioCreate(
            nome="Admin E-mail",
            email="admin-email@example.com",
            senha_plana="senha12345",
            funcao="Admin",
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
        ),
    )
    admin.empresa_id = emp.id
    db.commit()
    db.refresh(admin)
    return admin, emp


def test_convite_inclui_token_quando_resend_nao_configurado(client) -> None:
    db = SessionLocal()
    try:
        admin, _ = _seed_admin_com_empresa(db)
    finally:
        db.close()

    r = client.post(
        "/auth/login",
        json={"email": "admin-email@example.com", "senha": "senha12345"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    r2 = client.post(
        "/equipe/convites",
        headers=h,
        json={"emails": ["novo@example.com"]},
    )
    assert r2.status_code == 201
    body = r2.json()
    assert len(body) == 1
    assert body[0]["status"] == "convite_criado"
    assert "token" in body[0]
    assert body[0].get("convite_enviado_por_email") is not True


@patch("app.services.email_service.resend.Emails.send")
def test_convite_omite_token_quando_resend_envia(mock_send, client) -> None:
    mock_send.return_value = {"id": "mock-id"}
    db = SessionLocal()
    try:
        admin, _ = _seed_admin_com_empresa(db)
        cfg = ConfiguracaoEmail(
            id=1,
            resend_api_key="re_test_key",
            email_from="onboarding@resend.dev",
        )
        db.merge(cfg)
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/auth/login",
        json={"email": "admin-email@example.com", "senha": "senha12345"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    r2 = client.post(
        "/equipe/convites",
        headers=h,
        json={"emails": ["convidado@example.com"]},
    )
    assert r2.status_code == 201
    body = r2.json()
    assert len(body) == 1
    assert body[0]["status"] == "convite_criado"
    assert "token" not in body[0]
    assert body[0].get("convite_enviado_por_email") is True
    mock_send.assert_called_once()


@patch("app.services.email_service.resend.Emails.send")
def test_convite_inclui_token_quando_resend_falha(mock_send, client) -> None:
    mock_send.side_effect = RuntimeError("API error")
    db = SessionLocal()
    try:
        _seed_admin_com_empresa(db)
        cfg = ConfiguracaoEmail(
            id=1,
            resend_api_key="re_bad",
            email_from="onboarding@resend.dev",
        )
        db.merge(cfg)
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/auth/login",
        json={"email": "admin-email@example.com", "senha": "senha12345"},
    )
    token = r.json()["access_token"]
    r2 = client.post(
        "/equipe/convites",
        headers={"Authorization": f"Bearer {token}"},
        json={"emails": ["outro@example.com"]},
    )
    assert r2.status_code == 201
    body = r2.json()[0]
    assert "token" in body
    assert body.get("convite_enviado_por_email") is not True


@patch("app.services.email_service.resend.Emails.send")
def test_forgot_password_chama_resend_quando_configurado(mock_send, client) -> None:
    mock_send.return_value = {"id": "x"}
    db = SessionLocal()
    try:
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="User Reset",
                email="user-reset@example.com",
                senha_plana="senha12345",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
            ),
        )
        cfg = ConfiguracaoEmail(
            id=1,
            resend_api_key="re_test",
            email_from="onboarding@resend.dev",
        )
        db.merge(cfg)
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/forgot-password", json={"email": "user-reset@example.com"})
    assert r.status_code == 200
    mock_send.assert_called_once()
    call_kw = mock_send.call_args[0][0]
    assert call_kw["to"] == "user-reset@example.com"
    assert "redefinir-senha" in call_kw["html"]
