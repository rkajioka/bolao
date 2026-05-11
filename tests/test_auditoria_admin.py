from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models.auditoria_admin import AuditoriaAdmin
from tests.factories import seed_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_admin_cria_pais_e_gera_auditoria(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/paises",
        headers=h,
        json={"nome": "Time C", "sigla": "TC", "bandeira_url": "https://example.com/tc.png", "grupo": "A"},
    )
    assert r.status_code == 201, r.text

    db = SessionLocal()
    try:
        row = db.scalar(
            select(AuditoriaAdmin)
            .where(AuditoriaAdmin.acao == "paises.post", AuditoriaAdmin.status == "success")
            .order_by(AuditoriaAdmin.id.desc())
        )
        assert row is not None
        assert row.admin_user_id > 0
        assert row.entidade == "pais"
    finally:
        db.close()
