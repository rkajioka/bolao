from unittest.mock import patch

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models.empresa import Empresa
from app.models.usuario import Usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.services.email_service.enviar_email_outlook")
def test_convite_bloqueado_no_limite_alerta_owner(mock_send, client) -> None:
    from app.services.rate_limit_service import reset_key

    empresa_id: int
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Limite", codigo_empresa="emp-limite-1", ativo=True, max_usuarios=2)
        db.add(emp)
        db.commit()
        db.refresh(emp)

        owner = Usuario(
            nome="Owner",
            email="owner-limite@example.com",
            senha_hash=hash_password("senhaowner1"),
            tipo_usuario="owner",
            ativo=True,
            primeiro_login=False,
        )
        admin = Usuario(
            nome="Admin",
            email="admin-limite@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add_all([owner, admin])
        db.commit()
        empresa_id = emp.id
    finally:
        db.close()

    token = _login(client, "admin-limite@example.com", "senhaadmin1")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post(
        "/equipe/convites",
        headers=headers,
        json={"emails": ["primeiro@example.com"]},
    )
    assert r.status_code == 201, r.text
    assert r.json()["itens"][0]["status"] == "convite_criado"

    reset_key(f"convites_bulk:{empresa_id}")
    r2 = client.post(
        "/equipe/convites",
        headers=headers,
        json={"emails": ["segundo@example.com"]},
    )
    assert r2.status_code == 201, r2.text
    body = r2.json()
    assert body["itens"][0]["status"] == "limite_usuarios"
    assert body["resumo_envio"]["bloqueados_limite"] == 1
    assert body["resumo_envio"]["alerta_owners_limite_enviado"] is True
    assert mock_send.call_count >= 1


@patch("app.services.email_service.enviar_email_outlook")
def test_owner_pode_aumentar_cota_e_liberar_convite(mock_send, client) -> None:
    empresa_id: int
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Cota", codigo_empresa="emp-cota-1", ativo=True, max_usuarios=1)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        empresa_id = emp.id

        owner = Usuario(
            nome="Owner",
            email="owner-cota@example.com",
            senha_hash=hash_password("senhaowner1"),
            tipo_usuario="owner",
            ativo=True,
            primeiro_login=False,
        )
        admin = Usuario(
            nome="Admin",
            email="admin-cota@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add_all([owner, admin])
        db.commit()
    finally:
        db.close()

    owner_token = _login(client, "owner-cota@example.com", "senhaowner1")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    patch = client.patch(
        f"/empresas/{empresa_id}",
        headers=owner_headers,
        json={"max_usuarios": 2},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["max_usuarios"] == 2

    admin_token = _login(client, "admin-cota@example.com", "senhaadmin1")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    r = client.post(
        "/equipe/convites",
        headers=admin_headers,
        json={"emails": ["novo@example.com"]},
    )
    assert r.status_code == 201, r.text
    assert r.json()["itens"][0]["status"] == "convite_criado"


def test_create_usuario_respeita_limite_empresa(client) -> None:
    empresa_id: int
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Create", codigo_empresa="emp-create-quota", ativo=True, max_usuarios=1)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        empresa_id = emp.id

        owner = Usuario(
            nome="Owner",
            email="owner-create@example.com",
            senha_hash=hash_password("senhaowner1"),
            tipo_usuario="owner",
            ativo=True,
            primeiro_login=False,
        )
        db.add(owner)
        db.commit()
    finally:
        db.close()

    owner_token = _login(client, "owner-create@example.com", "senhaowner1")
    headers = {"Authorization": f"Bearer {owner_token}"}

    ok = client.post(
        "/usuarios",
        headers=headers,
        json={
            "nome": "Admin 1",
            "email": "admin-create@example.com",
            "tipo_usuario": "admin",
            "ativo": True,
            "primeiro_login": False,
            "empresa_id": empresa_id,
            "senha_plana": "SenhaAdmin1!",
        },
    )
    assert ok.status_code == 201, ok.text

    bloqueado = client.post(
        "/usuarios",
        headers=headers,
        json={
            "nome": "Admin 2",
            "email": "admin-create-2@example.com",
            "tipo_usuario": "admin",
            "ativo": True,
            "primeiro_login": False,
            "empresa_id": empresa_id,
            "senha_plana": "SenhaAdmin2!",
        },
    )
    assert bloqueado.status_code == 400, bloqueado.text
