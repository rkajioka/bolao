"""Etapa 13 — parâmetros de rota não quebram query (ORM / parâmetros seguros)."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_dois_paises


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_grupo_tabela_payload_malicioso_nao_causa_500(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        seed_dois_paises(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    grupo = "A' OR 1=1--"
    r = client.get(f"/grupos/{grupo}/tabela", headers=h)
    assert r.status_code in (400, 404)
    assert r.status_code != 500
