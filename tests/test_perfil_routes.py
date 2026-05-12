from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    response = client.post("/auth/login", json={"email": email, "senha": senha})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_perfil_requer_autenticacao(client) -> None:
    response = client.get("/perfil/", headers={"Accept": "application/json"})
    assert response.status_code == 401


def test_perfil_retorna_dados_autenticado(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    response = client.get("/perfil/", headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "user-etapa13@example.com"
