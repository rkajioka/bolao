from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.convite import Convite
from tests.factories import seed_admin_e_usuario


def test_ativar_conta_token_invalido(client) -> None:
    response = client.post(
        "/auth/ativar-conta",
        json={
            "token": "token-invalido",
            "senha": "SenhaSegura1!",
            "confirmar_senha": "SenhaSegura1!",
            "nome": "Novo Usuário",
        },
    )
    assert response.status_code in {400, 404, 422}


def test_ativar_conta_token_nao_reutilizavel(client) -> None:
    db = SessionLocal()
    try:
        admin_id, user_id = seed_admin_e_usuario(db)
        from app.models.usuario import Usuario

        admin = db.get(Usuario, admin_id)
        assert admin is not None and admin.empresa_id is not None
        token = "token-ativacao-teste-unico"
        db.add(
            Convite(
                empresa_id=admin.empresa_id,
                email="novo.convite@example.com",
                token=token,
                expiracao=datetime.now(UTC) + timedelta(hours=24),
                criado_por=admin_id,
            )
        )
        db.commit()
    finally:
        db.close()

    payload = {
        "token": token,
        "senha": "SenhaSegura1!",
        "confirmar_senha": "SenhaSegura1!",
        "nome": "Novo Convidado",
    }
    r1 = client.post("/auth/ativar-conta", json=payload)
    assert r1.status_code == 200, r1.text

    r2 = client.post("/auth/ativar-conta", json=payload)
    assert r2.status_code == 400, r2.text
