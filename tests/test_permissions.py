"""Etapa 13 — usuário comum não acessa rotas admin."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_dois_paises


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_usuario_comum_nao_lista_usuarios(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/usuarios", headers=h)
    assert r.status_code == 403


def test_usuario_comum_nao_cria_jogo(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/jogos",
        headers=h,
        json={
            "fase": "G",
            "grupo": "Z",
            "tipo_fase": "grupos",
            "pais_casa_id": a,
            "pais_fora_id": b,
            "data_jogo": "2030-06-01T18:00:00+00:00",
        },
    )
    assert r.status_code == 403


def test_admin_lista_usuarios(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/usuarios", headers=h)
    assert r.status_code == 200
    assert len(r.json()) >= 2
