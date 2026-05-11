"""Outlook (Graph): convite e reset — mock do envio."""

from __future__ import annotations

from unittest.mock import patch

from app.database import SessionLocal
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate
from app.services import usuario_service


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
            empresa_id=emp.id,
        ),
    )
    return admin, emp


@patch("app.services.email_service._enviar_email_outlook")
def test_convite_inclui_token_quando_outlook_falha(mock_send, client) -> None:
    mock_send.side_effect = RuntimeError("API error")
    db = SessionLocal()
    try:
        _seed_admin_com_empresa(db)
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


@patch("app.services.email_service._enviar_email_outlook")
def test_convite_omite_token_quando_outlook_envia(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _seed_admin_com_empresa(db)
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
    kwargs = mock_send.call_args.kwargs
    assert kwargs["nome_remetente"] == "Empresa Teste"
    assert "Empresa Teste" in kwargs["assunto"]


@patch("app.services.email_service._enviar_email_outlook")
def test_forgot_password_chama_outlook_com_nome_empresa(mock_send, client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Reset", codigo_empresa="emp-reset-1", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="User Reset",
                email="user-reset@example.com",
                senha_plana="senha12345",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp.id,
            ),
        )
    finally:
        db.close()

    r = client.post("/auth/forgot-password", json={"email": "user-reset@example.com"})
    assert r.status_code == 200
    mock_send.assert_called_once()
    kwargs = mock_send.call_args.kwargs
    assert kwargs["destinatario"] == "user-reset@example.com"
    assert kwargs["nome_remetente"] == "Empresa Reset"
    assert "Empresa Reset" in kwargs["corpo_html"]
    assert "redefinir-senha" in kwargs["corpo_html"]
