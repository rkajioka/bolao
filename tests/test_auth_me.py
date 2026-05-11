"""Dados do usuário autenticado em /auth/me."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario


def test_auth_me_inclui_nome_da_empresa(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post(
        "/auth/login",
        json={"email": "user-etapa13@example.com", "senha": "senhausuario1"},
    )
    assert r_login.status_code == 200, r_login.text
    token = r_login.json()["access_token"]

    r_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200, r_me.text
    body = r_me.json()
    assert body["empresa_id"] is not None
    assert body["empresa_nome"] == "Empresa Teste"
