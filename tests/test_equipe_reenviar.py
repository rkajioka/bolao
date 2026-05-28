"""Reenvio e renovação de convites na equipe."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_reenviar_convite_expirado_renova_token_e_expiracao(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Reenviar", codigo_empresa="emp-reenviar", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Reenviar",
            email="admin-reenviar@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        token_antigo = "token-expirado-reenviar"
        expiracao_antiga = datetime.now(UTC) - timedelta(hours=2)
        convite = Convite(
            empresa_id=emp.id,
            email="expirado.reenviar@example.com",
            token=token_antigo,
            expiracao=expiracao_antiga,
            criado_por=admin.id,
        )
        db.add(convite)
        db.commit()
        db.refresh(convite)
        convite_id = convite.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin-reenviar@example.com', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/reenviar", headers=headers)
    assert r.status_code == 204, r.text

    db = SessionLocal()
    try:
        atualizado = db.get(Convite, convite_id)
        assert atualizado is not None
        assert atualizado.token != token_antigo
        exp = atualizado.expiracao
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
        assert exp > datetime.now(UTC)
        assert atualizado.usado_em is None
    finally:
        db.close()


def test_reenviar_convite_pendente_mantem_token(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Pendente", codigo_empresa="emp-pendente-r", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Pendente",
            email="admin-pendente-r@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        token = "token-pendente-reenviar"
        convite = Convite(
            empresa_id=emp.id,
            email="pendente.reenviar@example.com",
            token=token,
            expiracao=datetime.now(UTC) + timedelta(hours=48),
            criado_por=admin.id,
        )
        db.add(convite)
        db.commit()
        db.refresh(convite)
        convite_id = convite.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin-pendente-r@example.com', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/reenviar", headers=headers)
    assert r.status_code == 204, r.text

    db = SessionLocal()
    try:
        atualizado = db.get(Convite, convite_id)
        assert atualizado is not None
        assert atualizado.token == token
    finally:
        db.close()
