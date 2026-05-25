"""Replay de refresh token revoga família e registra auditoria."""

from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models.audit_log import AuditLog
from tests.factories import seed_admin_e_usuario

_AUTH_CLIENT_HEADERS = {
    "X-Bolao-Client": "1",
    "Origin": "http://localhost:5173",
}


def test_refresh_replay_revoga_familia_e_audita(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200
    cookie_antigo = r_login.cookies.get("bolao_refresh_token")
    assert cookie_antigo

    r_refresh = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_refresh.status_code == 200

    client.cookies.set("bolao_refresh_token", cookie_antigo, path="/auth")
    r_replay = client.post("/auth/refresh", headers=_AUTH_CLIENT_HEADERS)
    assert r_replay.status_code == 401

    db = SessionLocal()
    try:
        logs = list(
            db.scalars(
                select(AuditLog).where(AuditLog.acao == "auth.refresh_replay_detectado")
            ).all()
        )
        assert len(logs) >= 1
    finally:
        db.close()
