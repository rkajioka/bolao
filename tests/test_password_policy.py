from unittest.mock import patch

from app.core.password_policy import SENHA_COMPLEXIDADE_MSG, validar_complexidade_senha
from app.database import SessionLocal
from app.models.empresa import Empresa
from app.schemas.usuario import UsuarioCreate
from app.services import password_reset_service, usuario_service
from tests.factories import seed_owner_admin_e_usuario
from tests.helpers import token_redefinir_senha_do_mock


def test_validar_complexidade_senha_rejeita_sem_maiuscula() -> None:
    try:
        validar_complexidade_senha("senha123!")
        assert False, "esperava ValueError"
    except ValueError as exc:
        assert str(exc) == SENHA_COMPLEXIDADE_MSG


def test_validar_complexidade_senha_rejeita_sem_especial() -> None:
    try:
        validar_complexidade_senha("Senha1234")
        assert False, "esperava ValueError"
    except ValueError as exc:
        assert str(exc) == SENHA_COMPLEXIDADE_MSG


def test_redefinir_senha_rejeita_senha_fraca(client) -> None:
    db = SessionLocal()
    token: str
    try:
        emp = Empresa(nome="Empresa Senha Fraca", codigo_empresa="emp-senha-fraca", ativo=True)
        db.add(emp)
        db.commit()
        db.refresh(emp)
        user, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Usuario Senha Fraca",
                email="senha-fraca@example.com",
                senha_plana="senha12345",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=True,
                empresa_id=emp.id,
            ),
        )
        token, _ = password_reset_service.gerar_e_enviar_reset_para_usuario(
            db,
            user,
            motivo="solicitacao",
            commit=True,
        )
    finally:
        db.close()

    r = client.post(
        "/auth/redefinir-senha",
        json={
            "token": token,
            "nova_senha": "novasenha1",
            "confirmar_senha": "novasenha1",
        },
    )
    assert r.status_code == 422, r.text


@patch("app.services.email_service.enviar_email_outlook")
def test_reset_gestor_envia_link_sem_senha_no_email(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    owner_token = client.post(
        "/auth/login",
        json={"email": "owner-etapa13@example.com", "senha": "senhaowner1"},
    ).json()["access_token"]
    r = client.patch(
        f"/usuarios/{user_id}/reset-password",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r.status_code == 200, r.text
    html = mock_send.call_args.kwargs.get("corpo_html", "")
    assert "senha temporária" not in html.lower()
    assert "redefinir-senha?token=" in html

    token = token_redefinir_senha_do_mock(mock_send)
    login_antigo = client.post(
        "/auth/login",
        json={"email": "user-etapa13@example.com", "senha": "senhausuario1"},
    )
    assert login_antigo.status_code == 401

    r_def = client.post(
        "/auth/redefinir-senha",
        json={
            "token": token,
            "nova_senha": "NovaSenha1!",
            "confirmar_senha": "NovaSenha1!",
        },
    )
    assert r_def.status_code == 200, r_def.text
    user_token = r_def.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me.status_code == 200, me.text
    assert me.json()["primeiro_login"] is False
