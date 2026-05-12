"""Etapa 13 — permissões por papel."""

from __future__ import annotations

import re
from unittest.mock import patch

from app.database import SessionLocal
from app.core.password_defaults import SENHA_PADRAO_TEMPORARIA
from tests.factories import (
    seed_admin_e_usuario,
    seed_dois_paises,
    seed_jogo_grupo_em_breve,
    seed_jogo_grupo_iniciado_ha_horas,
    seed_owner_admin_e_usuario,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _senha_temporaria_do_mock(mock_send) -> str:
    mock_send.assert_called_once()
    html = mock_send.call_args.kwargs.get("corpo_html", "")
    matches = re.findall(r"<strong>([^<]+)</strong>", html)
    assert matches
    return matches[-1]


def test_usuario_comum_nao_lista_usuarios(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/usuarios", headers=h)
    assert r.status_code == 403


def test_usuario_comum_nao_cria_jogo(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/jogos",
        headers=h,
        json={
            "fase": "G",
            "grupo": "Z",
            "tipo_fase": "grupos",
            "pais_casa_id": a,
            "pais_fora_id": b,
            "data_jogo": "2030-06-01T18:00:00+00:00",
        },
    )
    assert r.status_code == 403


def test_admin_nao_lista_usuarios_globais(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/usuarios", headers=h)
    assert r.status_code == 403


def test_owner_lista_usuarios(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/usuarios", headers=h)
    assert r.status_code == 200
    assert len(r.json()) >= 3


def test_admin_empresa_pode_criar_palpite_jogo(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        casa_id, fora_id = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, casa_id, fora_id)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-jogos",
        headers=h,
        json={
            "jogo_id": jogo_id,
            "palpite_casa": 1,
            "palpite_fora": 0,
            "palpite_classificado_id": None,
        },
    )
    assert r.status_code == 201, r.text


def test_owner_nao_pode_criar_palpite_jogo(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        casa_id, fora_id = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, casa_id, fora_id)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-jogos",
        headers=h,
        json={
            "jogo_id": jogo_id,
            "palpite_casa": 1,
            "palpite_fora": 0,
            "palpite_classificado_id": None,
        },
    )
    assert r.status_code == 403


def test_owner_nao_finaliza_antes_de_2h(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        casa_id, fora_id = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, casa_id, fora_id)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert (
        client.patch(
            f"/jogos/{jogo_id}/resultado",
            headers=h,
            json={"placar_casa": 2, "placar_fora": 1},
        ).status_code
        == 200
    )
    r = client.patch(f"/jogos/{jogo_id}/finalizar", headers=h, json={})
    assert r.status_code == 400
    assert "2 horas" in r.json()["detail"]


def test_owner_pode_lancar_resultado_oficial(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        casa_id, fora_id = seed_dois_paises(db)
        jogo = seed_jogo_grupo_iniciado_ha_horas(db, casa_id, fora_id)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.patch(
        f"/jogos/{jogo_id}/resultado",
        headers=h,
        json={"placar_casa": 2, "placar_fora": 1},
    )
    assert r.status_code == 200, r.text
    assert r.json()["placar_casa"] == 2
    assert r.json()["placar_fora"] == 1

    r2 = client.patch(f"/jogos/{jogo_id}/finalizar", headers=h, json={})
    assert r2.status_code == 200, r2.text
    assert r2.json()["finalizado"] is True


def test_admin_nao_pode_lancar_resultado_oficial(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        casa_id, fora_id = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, casa_id, fora_id)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.patch(
        f"/jogos/{jogo_id}/resultado",
        headers=h,
        json={"placar_casa": 1, "placar_fora": 0},
    )
    assert r.status_code == 403


def test_owner_nao_pode_salvar_palpite_especial(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        campeao_id, vice_id = a, b
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={
            "campeao_id": campeao_id,
            "vice_campeao_id": vice_id,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
        },
    )
    assert r.status_code == 403


@patch("app.services.email_service.enviar_email_outlook")
def test_owner_reset_senha_define_padrao_e_exige_primeiro_acesso(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    owner_token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h_owner = {"Authorization": f"Bearer {owner_token}"}
    r = client.patch(f"/usuarios/{user_id}/reset-password", headers=h_owner)
    assert r.status_code == 200, r.text
    senha_temporaria = _senha_temporaria_do_mock(mock_send)

    login = client.post(
        "/auth/login",
        json={"email": "user-etapa13@example.com", "senha": senha_temporaria},
    )
    assert login.status_code == 200, login.text
    assert login.json()["primeiro_login"] is True

    user_token = login.json()["access_token"]
    h_user = {"Authorization": f"Bearer {user_token}"}
    bloqueado = client.post(
        "/palpites-jogos",
        headers=h_user,
        json={"jogo_id": 1, "palpite_casa": 1, "palpite_fora": 0},
    )
    assert bloqueado.status_code == 403


@patch("app.services.email_service.enviar_email_outlook")
def test_admin_redefine_senha_apenas_da_propria_empresa(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    admin_token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h_admin = {"Authorization": f"Bearer {admin_token}"}
    r = client.patch(f"/equipe/{user_id}/reset-password", headers=h_admin)
    assert r.status_code == 204, r.text
    mock_send.assert_called_once()

    outro_token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h_owner = {"Authorization": f"Bearer {outro_token}"}
    r2 = client.patch(
        f"/equipe/{user_id}/reset-password?empresa_id=99999",
        headers=h_owner,
    )
    assert r2.status_code in {403, 404}


@patch("app.services.email_service.enviar_email_outlook")
def test_primeiro_acesso_rejeita_senha_padrao(mock_send, client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    owner_token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h_owner = {"Authorization": f"Bearer {owner_token}"}
    r = client.patch(f"/usuarios/{user_id}/reset-password", headers=h_owner)
    assert r.status_code == 200, r.text
    senha_temporaria = _senha_temporaria_do_mock(mock_send)

    user_token = _login(client, "user-etapa13@example.com", senha_temporaria)
    h_user = {"Authorization": f"Bearer {user_token}"}
    r = client.post(
        "/auth/primeiro-acesso",
        headers=h_user,
        json={
            "nome": "Usuário Teste",
            "funcao": "Jogador",
            "nova_senha": SENHA_PADRAO_TEMPORARIA,
            "confirmar_senha": SENHA_PADRAO_TEMPORARIA,
        },
    )
    assert r.status_code == 422, r.text
