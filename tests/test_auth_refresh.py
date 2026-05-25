"""Fluxo de refresh token com rotação e logout."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario

_AUTH_CLIENT_HEADERS = {
    "X-Bolao-Client": "1",
    "Origin": "http://localhost:5173",
}


def test_login_define_cookie_refresh(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()
    assert "bolao_refresh_token=" in r.headers.get("set-cookie", "")


def test_refresh_rotaciona_token_e_reuso_falha(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200, r_login.text
    cookie_antigo = r_login.cookies.get("bolao_refresh_token")
    assert cookie_antigo

    r_refresh = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_refresh.status_code == 200, r_refresh.text
    assert "access_token" in r_refresh.json()
    cookie_novo = r_refresh.cookies.get("bolao_refresh_token")
    assert cookie_novo and cookie_novo != cookie_antigo

    client.cookies.set("bolao_refresh_token", cookie_antigo, path="/auth")
    r_reuso = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_reuso.status_code == 401


def test_change_password_revoga_refresh_tokens_anteriores(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200, r_login.text
    access = r_login.json()["access_token"]
    cookie_antigo = r_login.cookies.get("bolao_refresh_token")
    assert cookie_antigo

    r_pw = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "senha_atual": "senhausuario1",
            "nova_senha": "NovaSenhaSegura1!",
            "confirmar_senha": "NovaSenhaSegura1!",
        },
    )
    assert r_pw.status_code == 204, r_pw.text

    client.cookies.set("bolao_refresh_token", cookie_antigo, path="/auth")
    r_refresh = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_refresh.status_code == 401


def test_logout_revoga_cookie_refresh(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200, r_login.text

    r_logout = client.post("/auth/logout", headers=_AUTH_CLIENT_HEADERS)
    assert r_logout.status_code == 204
    assert "bolao_refresh_token=" in r_logout.headers.get("set-cookie", "")

    r_refresh = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_refresh.status_code == 401
