from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_owner_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    response = client.post("/auth/login", json={"email": email, "senha": senha})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_plataforma_tema_requer_sessao(client) -> None:
    response = client.get("/plataforma/tema")
    assert response.status_code == 401


def test_plataforma_tema_owner_autenticado(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    response = client.get("/plataforma/tema", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert "tokens_dark" in response.json()
