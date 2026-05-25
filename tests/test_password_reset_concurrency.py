from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.password_reset import PasswordReset
from tests.factories import seed_admin_e_usuario


def test_redefinir_senha_token_nao_reutilizavel(client) -> None:
    db = SessionLocal()
    try:
        _, user_id = seed_admin_e_usuario(db)
        token = "reset-token-unico-teste"
        db.add(
            PasswordReset(
                usuario_id=user_id,
                token=token,
                expiracao=datetime.now(UTC) + timedelta(hours=1),
                usado=False,
            )
        )
        db.commit()
    finally:
        db.close()

    payload = {
        "token": token,
        "nova_senha": "NovaSenhaSegura1!",
        "confirmar_senha": "NovaSenhaSegura1!",
    }
    r1 = client.post("/auth/redefinir-senha", json=payload)
    assert r1.status_code == 200, r1.text

    r2 = client.post("/auth/redefinir-senha", json=payload)
    assert r2.status_code == 400, r2.text
