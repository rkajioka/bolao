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
    admin, _ = usuario_service.create_usuario(
        db,
        UsuarioCreate.model_construct(
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


@patch("app.services.email_service.enviar_email_outlook")
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
    assert len(body["itens"]) == 1
    assert body["itens"][0]["status"] == "convite_criado"
    assert "token" not in body["itens"][0]
    convite_calls = [
        c for c in mock_send.call_args_list if c.kwargs.get("destinatario") == "novo@example.com"
    ]
    assert len(convite_calls) >= 1


@patch("app.services.email_service.enviar_email_outlook")
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
    assert len(body["itens"]) == 1
    assert body["itens"][0]["status"] == "convite_criado"
    assert "token" not in body["itens"][0]
    convite_calls = [
        c for c in mock_send.call_args_list if c.kwargs.get("destinatario") == "convidado@example.com"
    ]
    assert len(convite_calls) >= 1
    kwargs = convite_calls[0].kwargs
    assert kwargs["nome_remetente"] == "Empresa Teste"
    assert "Empresa Teste" in kwargs["assunto"]


@patch("app.services.email_service.enviar_email_outlook")
def test_convite_falha_parcial_nao_interrompe_outros(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _seed_admin_com_empresa(db)
    finally:
        db.close()

    mock_send.side_effect = [
        RuntimeError("falha 1"),
        RuntimeError("falha 1"),
        RuntimeError("falha 1"),
        None,
        None,
        None,
    ]

    r = client.post(
        "/auth/login",
        json={"email": "admin-email@example.com", "senha": "senha12345"},
    )
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r2 = client.post(
        "/equipe/convites",
        headers=h,
        json={"emails": ["falha@example.com", "ok@example.com"]},
    )
    assert r2.status_code == 201
    body = r2.json()
    assert len(body["itens"]) == 2
    assert body["itens"][0]["email"] == "falha@example.com"
    assert body["itens"][0]["status"] == "convite_criado"
    assert body["itens"][1]["email"] == "ok@example.com"
    assert body["itens"][1]["status"] == "convite_criado"
    destinatarios = {c.kwargs["destinatario"] for c in mock_send.call_args_list}
    assert "falha@example.com" in destinatarios
    assert "ok@example.com" in destinatarios


@patch("app.services.email_service.enviar_email_outlook")
def test_convite_falha_alerta_todos_admins_da_empresa(mock_send, client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Alerta", codigo_empresa="emp-alerta-1", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Admin 1",
                email="admin1@example.com",
                senha_plana="senha12345",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp.id,
            ),
        )
        usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Admin 2",
                email="admin2@example.com",
                senha_plana="senha12345",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp.id,
            ),
        )
    finally:
        db.close()

    def side_effect(**kwargs):
        if kwargs["destinatario"] == "convidado@example.com":
            raise RuntimeError("falha convite")
        return None

    mock_send.side_effect = side_effect

    r = client.post("/auth/login", json={"email": "admin1@example.com", "senha": "senha12345"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r2 = client.post(
        "/equipe/convites",
        headers=h,
        json={"emails": ["convidado@example.com"]},
    )
    assert r2.status_code == 201
    destinatarios = {call.kwargs["destinatario"] for call in mock_send.call_args_list}
    assert "admin1@example.com" in destinatarios
    assert "admin2@example.com" in destinatarios


@patch("app.services.email_service.enviar_email_outlook")
def test_criar_usuario_envia_link_de_redefinicao(mock_send, client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Criacao", codigo_empresa="emp-create-1", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        empresa_id = emp.id
        owner, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Owner Criacao",
                email="owner-create@example.com",
                senha_plana="senhaowner1",
                tipo_usuario="owner",
                ativo=True,
                primeiro_login=False,
            ),
        )
        owner_email = owner.email
    finally:
        db.close()

    r = client.post(
        "/auth/login",
        json={"email": owner_email, "senha": "senhaowner1"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    r2 = client.post(
        "/usuarios",
        headers=h,
        json={
            "nome": "Novo Admin",
            "email": "novo-admin@example.com",
            "tipo_usuario": "admin",
            "ativo": True,
            "primeiro_login": True,
            "empresa_id": empresa_id,
        },
    )
    assert r2.status_code == 201
    assert r2.json()["email_enviado"] is True
    mock_send.assert_called_once()
    kwargs = mock_send.call_args.kwargs
    assert kwargs["destinatario"] == "novo-admin@example.com"
    assert kwargs["nome_remetente"] == "Empresa Criacao"
    assert "redefinir-senha" in kwargs["corpo_html"]
    assert "senhaadmin1" not in kwargs["corpo_html"]


@patch("app.services.email_service.enviar_email_outlook")
def test_forgot_password_chama_outlook_com_nome_empresa(mock_send, client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Reset", codigo_empresa="emp-reset-1", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
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


@patch("app.services.email_service.enviar_email_outlook")
def test_redefinir_senha_encerra_primeiro_login(mock_send, client) -> None:
    db = SessionLocal()
    user_id: int
    token: str
    try:
        emp = Empresa(nome="Empresa Primeiro Login", codigo_empresa="emp-primeiro-1", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        user, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Usuario Primeiro Login",
                email="primeiro-login@example.com",
                senha_plana="senha12345",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=True,
                empresa_id=emp.id,
            ),
        )
        user_id = user.id
        from app.services import password_reset_service

        token, _ = password_reset_service.gerar_e_enviar_reset_para_usuario(
            db,
            user,
            motivo="solicitacao",
            commit=True,
        )
    finally:
        db.close()

    r = client.post(
        "/auth/redefinir-senha",
        json={
            "token": token,
            "nova_senha": "NovaSenha1!",
            "confirmar_senha": "NovaSenha1!",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]

    db_check = SessionLocal()
    try:
        refreshed = db_check.get(Usuario, user_id)
        assert refreshed is not None
        assert refreshed.primeiro_login is False
    finally:
        db_check.close()
