from __future__ import annotations

from app.services.rate_limit_service import reset_all
from tests.factories import seed_admin_e_usuario


def test_rate_limit_login_retorna_429(client) -> None:
    reset_all()
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    for _ in range(5):
        r = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senha-errada"})
        assert r.status_code == 401

    r = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senha-errada"})
    assert r.status_code == 429
