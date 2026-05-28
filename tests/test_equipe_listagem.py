"""Listagem unificada de equipe (GET /equipe) e renovação de convites."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate
from app.services import usuario_service
from tests.factories import seed_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_listar_equipe_retorna_todos_usuarios_da_empresa(client) -> None:
    db = SessionLocal()
    try:
        admin_id, _ = seed_admin_e_usuario(db)
        admin = db.get(Usuario, admin_id)
        assert admin is not None and admin.empresa_id is not None

        pendente, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Aguardando Ativação",
                email="pendente.equipe@example.com",
                senha_plana="senhapendente1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=True,
                empresa_id=admin.empresa_id,
            ),
        )
        assert pendente.empresa_id == admin.empresa_id
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/equipe", headers={**headers, "Accept": "application/json"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert len(body) >= 3

    emails = {item["email"] for item in body if item["tipo"] == "usuario"}
    assert "admin-etapa13@example.com" in emails
    assert "user-etapa13@example.com" in emails
    assert "pendente.equipe@example.com" in emails

    pendente_item = next(
        item for item in body if item.get("email") == "pendente.equipe@example.com"
    )
    assert pendente_item["tipo"] == "usuario"
    assert pendente_item["primeiro_login"] is True


def test_listar_equipe_inclui_convite_pendente(client) -> None:
    db = SessionLocal()
    try:
        admin_id, _ = seed_admin_e_usuario(db)
        admin = db.get(Usuario, admin_id)
        assert admin is not None and admin.empresa_id is not None
        db.add(
            Convite(
                empresa_id=admin.empresa_id,
                email="convidado.listagem@example.com",
                token="token-listagem-equipe",
                expiracao=datetime.now(UTC) + timedelta(hours=48),
                criado_por=admin_id,
            )
        )
        db.commit()
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    r = client.get(
        "/equipe",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    assert r.status_code == 200, r.text
    convites = [item for item in r.json() if item["tipo"] == "convite"]
    assert any(c["email"] == "convidado.listagem@example.com" for c in convites)
    pendente = next(c for c in convites if c["email"] == "convidado.listagem@example.com")
    assert pendente["status"] == "convite_pendente"


def test_listar_equipe_inclui_convite_expirado(client) -> None:
    db = SessionLocal()
    try:
        admin_id, _ = seed_admin_e_usuario(db)
        admin = db.get(Usuario, admin_id)
        assert admin is not None and admin.empresa_id is not None
        db.add(
            Convite(
                empresa_id=admin.empresa_id,
                email="expirado.listagem@example.com",
                token="token-expirado-listagem",
                expiracao=datetime.now(UTC) - timedelta(hours=1),
                criado_por=admin_id,
            )
        )
        db.commit()
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    r = client.get(
        "/equipe",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    assert r.status_code == 200, r.text
    convites = [item for item in r.json() if item["tipo"] == "convite"]
    expirado = next((c for c in convites if c["email"] == "expirado.listagem@example.com"), None)
    assert expirado is not None
    assert expirado["status"] == "convite_expirado"


def test_listar_equipe_nao_inclui_convite_usado(client) -> None:
    db = SessionLocal()
    try:
        admin_id, _ = seed_admin_e_usuario(db)
        admin = db.get(Usuario, admin_id)
        assert admin is not None and admin.empresa_id is not None
        db.add(
            Convite(
                empresa_id=admin.empresa_id,
                email="usado.listagem@example.com",
                token="token-usado-listagem",
                expiracao=datetime.now(UTC) + timedelta(hours=48),
                usado_em=datetime.now(UTC),
                criado_por=admin_id,
            )
        )
        db.commit()
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    r = client.get(
        "/equipe",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    assert r.status_code == 200, r.text
    assert not any(item.get("email") == "usado.listagem@example.com" for item in r.json())


def test_renovar_convite_expirado_aparece_na_listagem(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Empresa Convite", codigo_empresa="emp-convite-list", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Convite",
            email="admin-convite-list@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        db.add(
            Convite(
                empresa_id=emp.id,
                email="expirado.renova@example.com",
                token="token-expirado-renova",
                expiracao=datetime.now(UTC) - timedelta(hours=1),
                criado_por=admin.id,
            )
        )
        db.commit()
        empresa_id = emp.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin-convite-list@example.com', 'senhaadmin1')}"}

    api_headers = {**headers, "Accept": "application/json"}
    r_antes = client.get("/equipe", headers=api_headers)
    assert r_antes.status_code == 200
    antes = next(
        (item for item in r_antes.json() if item.get("email") == "expirado.renova@example.com"),
        None,
    )
    assert antes is not None
    assert antes["status"] == "convite_expirado"

    r_post = client.post(
        "/equipe/convites",
        headers=headers,
        json={"emails": ["expirado.renova@example.com"]},
    )
    assert r_post.status_code == 201, r_post.text
    assert r_post.json()["itens"][0]["status"] == "convite_criado"

    r_depois = client.get("/equipe", headers=api_headers)
    assert r_depois.status_code == 200
    convites = [item for item in r_depois.json() if item["tipo"] == "convite"]
    assert any(c["email"] == "expirado.renova@example.com" for c in convites)
