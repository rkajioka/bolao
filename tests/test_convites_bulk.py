from __future__ import annotations

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
def test_convites_bulk_rate_limit_por_empresa(mock_send, client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Rate", codigo_empresa="emp-rate-1", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin",
            email="admin-rate@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin-rate@example.com', 'senhaadmin1')}"}
    payload = {"emails": ["a@example.com"]}

    r1 = client.post("/equipe/convites", headers=headers, json=payload)
    assert r1.status_code == 201, r1.text

    r2 = client.post("/equipe/convites", headers=headers, json={"emails": ["b@example.com"]})
    assert r2.status_code == 429, r2.text
