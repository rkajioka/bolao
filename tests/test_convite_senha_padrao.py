"""Provisionamento de convites com senha padrão e 1º acesso."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from app.auth.password import hash_password
from app.core.password_defaults import SENHA_PADRAO_TEMPORARIA
from app.database import SessionLocal
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _seed_admin_empresa_convite(
    db,
    *,
    email_convite: str,
    expiracao: datetime,
    max_usuarios: int = 50,
) -> tuple[int, int, int]:
    emp = Empresa(
        nome="Emp Senha Padrao",
        codigo_empresa=f"emp-sp-{email_convite.split('@')[0]}",
        ativo=True,
        max_usuarios=max_usuarios,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    admin = Usuario(
        nome="Admin SP",
        email=f"admin.{email_convite}",
        senha_hash=hash_password("senhaadmin1"),
        tipo_usuario="admin",
        ativo=True,
        primeiro_login=False,
        empresa_id=emp.id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    convite = Convite(
        empresa_id=emp.id,
        email=email_convite,
        token=f"token-{email_convite}",
        expiracao=expiracao,
        criado_por=admin.id,
    )
    db.add(convite)
    db.commit()
    db.refresh(convite)
    return emp.id, admin.id, convite.id


def test_provisionar_convite_expirado_cria_usuario_e_login(client) -> None:
    email = "expirado.sp@example.com"
    db = SessionLocal()
    try:
        _, _, convite_id = _seed_admin_empresa_convite(
            db,
            email_convite=email,
            expiracao=datetime.now(UTC) - timedelta(hours=1),
        )
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, f'admin.{email}', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers)
    assert r.status_code == 204, r.text

    from sqlalchemy import select

    db = SessionLocal()
    try:
        usuario = db.scalar(select(Usuario).where(Usuario.email == email))
        assert usuario is not None
        assert usuario.nome == email
        assert usuario.primeiro_login is True
        convite = db.get(Convite, convite_id)
        assert convite is not None and convite.usado_em is not None
    finally:
        db.close()

    token = _login(client, email, SENHA_PADRAO_TEMPORARIA)
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["primeiro_login"] is True


def test_provisionar_convite_pendente_invalida_link_ativacao(client) -> None:
    email = "pendente.sp@example.com"
    token_convite = "token-pendente-sp-unico"
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Pend SP", codigo_empresa="emp-pend-sp", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin",
            email="admin.pendente.sp@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        convite = Convite(
            empresa_id=emp.id,
            email=email,
            token=token_convite,
            expiracao=datetime.now(UTC) + timedelta(hours=24),
            criado_por=admin.id,
        )
        db.add(convite)
        db.commit()
        db.refresh(convite)
        convite_id = convite.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin.pendente.sp@example.com', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers)
    assert r.status_code == 204, r.text

    r_ativar = client.post(
        "/auth/ativar-conta",
        json={
            "token": token_convite,
            "nome": "Novo Nome",
            "senha": "SenhaSegura1!",
            "confirmar_senha": "SenhaSegura1!",
        },
    )
    assert r_ativar.status_code == 400, r_ativar.text


def test_provisionar_convite_ja_usado_retorna_400(client) -> None:
    email = "usado.sp@example.com"
    db = SessionLocal()
    try:
        _, _, convite_id = _seed_admin_empresa_convite(
            db,
            email_convite=email,
            expiracao=datetime.now(UTC) - timedelta(hours=2),
        )
        convite = db.get(Convite, convite_id)
        assert convite is not None
        convite.usado_em = datetime.now(UTC)
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, f'admin.{email}', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers)
    assert r.status_code == 400, r.text


def test_provisionar_convite_usuario_ja_ativado(client) -> None:
    email = "ativado.sp@example.com"
    db = SessionLocal()
    try:
        emp_id, _, convite_id = _seed_admin_empresa_convite(
            db,
            email_convite=email,
            expiracao=datetime.now(UTC) - timedelta(hours=1),
        )
        db.add(
            Usuario(
                nome="Ja Ativo",
                email=email,
                senha_hash=hash_password("outrasenha1"),
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp_id,
            )
        )
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, f'admin.{email}', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers)
    assert r.status_code == 400, r.text


@patch("app.services.email_service.enviar_email_outlook")
def test_provisionar_convite_cota_cheia_alerta_owner(mock_send, client) -> None:
    email = "cota.sp@example.com"
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Cota SP", codigo_empresa="emp-cota-sp", ativo=True, max_usuarios=1)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        owner = Usuario(
            nome="Owner Cota",
            email="owner.cota.sp@example.com",
            senha_hash=hash_password("senhaowner1"),
            tipo_usuario="owner",
            ativo=True,
            primeiro_login=False,
        )
        admin = Usuario(
            nome="Admin Cota",
            email="admin.cota.sp@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add_all([owner, admin])
        db.commit()
        db.refresh(admin)
        convite = Convite(
            empresa_id=emp.id,
            email=email,
            token="token-cota-sp",
            expiracao=datetime.now(UTC) - timedelta(hours=1),
            criado_por=admin.id,
        )
        db.add(convite)
        db.commit()
        db.refresh(convite)
        convite_id = convite.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin.cota.sp@example.com', 'senhaadmin1')}"}
    r = client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers)
    assert r.status_code == 400, r.text
    assert mock_send.call_count >= 1


def test_reaplicar_senha_padrao_usuario_aguardando_ativacao(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Reap SP", codigo_empresa="emp-reap-sp", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Reap",
            email="admin.reap.sp@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        user = Usuario(
            nome="user.reap.sp@example.com",
            email="user.reap.sp@example.com",
            senha_hash=hash_password("outrasenha1"),
            tipo_usuario="usuario",
            ativo=True,
            primeiro_login=True,
            empresa_id=emp.id,
        )
        db.add_all([admin, user])
        db.commit()
        db.refresh(user)
        user_id = user.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin.reap.sp@example.com', 'senhaadmin1')}"}
    r = client.patch(f"/equipe/{user_id}/senha-padrao", headers=headers)
    assert r.status_code == 204, r.text

    token = _login(client, "user.reap.sp@example.com", SENHA_PADRAO_TEMPORARIA)
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["primeiro_login"] is True


def test_reaplicar_senha_padrao_usuario_ja_ativado(client) -> None:
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Ativo SP", codigo_empresa="emp-ativo-sp", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin",
            email="admin.ativo.sp@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        user = Usuario(
            nome="Usuario Ativo",
            email="user.ativo.sp@example.com",
            senha_hash=hash_password("senhausuario1"),
            tipo_usuario="usuario",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add_all([admin, user])
        db.commit()
        db.refresh(user)
        user_id = user.id
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin.ativo.sp@example.com', 'senhaadmin1')}"}
    r = client.patch(f"/equipe/{user_id}/senha-padrao", headers=headers)
    assert r.status_code == 400, r.text


def test_primeiro_acesso_rejeita_nome_igual_email(client) -> None:
    email = "nome.email.sp@example.com"
    db = SessionLocal()
    try:
        emp = Empresa(nome="Emp Nome", codigo_empresa="emp-nome-sp", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        user = Usuario(
            nome=email,
            email=email,
            senha_hash=hash_password(SENHA_PADRAO_TEMPORARIA),
            tipo_usuario="usuario",
            ativo=True,
            primeiro_login=True,
            empresa_id=emp.id,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    token = _login(client, email, SENHA_PADRAO_TEMPORARIA)
    r = client.post(
        "/auth/primeiro-acesso",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "nome": email,
            "funcao": "Jogador",
            "nova_senha": "NovaSenha1!",
            "confirmar_senha": "NovaSenha1!",
        },
    )
    assert r.status_code == 400, r.text


def test_provisionar_expirados_lote(client) -> None:
    emails = ["lote1.sp@example.com", "lote2.sp@example.com"]
    db = SessionLocal()
    convite_ids: list[int] = []
    try:
        emp = Empresa(nome="Emp Lote", codigo_empresa="emp-lote-sp", ativo=True, max_usuarios=50)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        admin = Usuario(
            nome="Admin Lote",
            email="admin.lote.sp@example.com",
            senha_hash=hash_password("senhaadmin1"),
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
            empresa_id=emp.id,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        for i, email in enumerate(emails):
            convite = Convite(
                empresa_id=emp.id,
                email=email,
                token=f"token-lote-{i}",
                expiracao=datetime.now(UTC) - timedelta(hours=1),
                criado_por=admin.id,
            )
            db.add(convite)
            db.flush()
            convite_ids.append(convite.id)
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, 'admin.lote.sp@example.com', 'senhaadmin1')}"}
    r = client.post("/equipe/convites/provisionar-expirados", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    assert body["provisionados"] == 2
    assert body["erros"] == 0

    for email in emails:
        token = _login(client, email, SENHA_PADRAO_TEMPORARIA)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["primeiro_login"] is True


def test_fluxo_e2e_provision_login_primeiro_acesso(client) -> None:
    email = "e2e.sp@example.com"
    db = SessionLocal()
    try:
        _, _, convite_id = _seed_admin_empresa_convite(
            db,
            email_convite=email,
            expiracao=datetime.now(UTC) - timedelta(hours=3),
        )
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {_login(client, f'admin.{email}', 'senhaadmin1')}"}
    assert client.post(f"/equipe/convites/{convite_id}/senha-padrao", headers=headers).status_code == 204

    token = _login(client, email, SENHA_PADRAO_TEMPORARIA)
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/auth/primeiro-acesso",
        headers=h,
        json={
            "nome": "Participante E2E",
            "funcao": "Analista",
            "nova_senha": "NovaSenha1!",
            "confirmar_senha": "NovaSenha1!",
        },
    )
    assert r.status_code == 204, r.text

    me = client.get("/auth/me", headers=h)
    assert me.status_code == 200
    body = me.json()
    assert body["primeiro_login"] is False
    assert body["nome"] == "Participante E2E"
