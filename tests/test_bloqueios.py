"""Etapa 13 — bloqueios de palpites, especiais e marcadores."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.schemas.empresa import EmpresaCreate
from app.schemas.usuario import UsuarioCreate
from app.services import empresa_service, usuario_service
from tests.factories import (
    seed_admin_e_usuario,
    seed_config_com_bloqueio_especiais,
    seed_dois_paises,
    seed_jogo_grupo_passado,
    seed_owner_admin_e_usuario,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _patch_override(client, token: str, modo: str):
    return client.patch(
        "/configuracao-bolao/palpites-especiais-bloqueio",
        headers={"Authorization": f"Bearer {token}"},
        json={"modo": modo},
    )


def test_palpite_bloqueado_apos_inicio_jogo(client) -> None:
    db = SessionLocal()
    try:
        _, _uid = seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_passado(db, a, b)
        jogo_id = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-jogos",
        headers=h,
        json={"jogo_id": jogo_id, "palpite_casa": 1, "palpite_fora": 0},
    )
    assert r.status_code == 409


def _payload_configuracao(client, token: str) -> dict:
    r = client.get("/configuracao-bolao", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    return {
        k: body[k]
        for k in body
        if k
        not in {
            "id",
            "created_at",
            "updated_at",
            "empresa_id",
            "marcadores_brasil_habilitado",
            "data_bloqueio_palpites_especiais_efetiva",
            "palpites_especiais_bloqueados",
            "override_bloqueio_palpites_especiais",
        }
    }


def test_admin_pode_definir_bloqueio_especiais_uma_vez(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    payload = _payload_configuracao(client, token)
    bloqueio = (datetime.now(UTC) + timedelta(days=7)).replace(microsecond=0).isoformat()
    payload["data_bloqueio_palpites_especiais"] = bloqueio

    r_put = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_put.status_code == 200, r_put.text
    assert r_put.json()["data_bloqueio_palpites_especiais"] is not None


def test_admin_pode_alterar_data_bloqueio_livremente(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    payload = _payload_configuracao(client, token)
    data_a = (datetime.now(UTC) + timedelta(days=7)).replace(microsecond=0).isoformat()
    payload["data_bloqueio_palpites_especiais"] = data_a
    assert client.put("/configuracao-bolao", headers=h, json=payload).status_code == 200

    data_b = (datetime.now(UTC) + timedelta(days=14)).replace(microsecond=0).isoformat()
    payload["data_bloqueio_palpites_especiais"] = data_b
    r_put = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_put.status_code == 200, r_put.text
    assert r_put.json()["data_bloqueio_palpites_especiais"].startswith(data_b[:19])


def test_admin_pode_atualizar_pontos_mantendo_bloqueio_especiais(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    payload = _payload_configuracao(client, token)
    bloqueio = (datetime.now(UTC) + timedelta(days=7)).replace(microsecond=0).isoformat()
    payload["data_bloqueio_palpites_especiais"] = bloqueio
    r_primeiro = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_primeiro.status_code == 200, r_primeiro.text
    salvo = r_primeiro.json()["data_bloqueio_palpites_especiais"]

    payload["pontos_campeao"] = int(payload["pontos_campeao"]) + 1
    payload["data_bloqueio_palpites_especiais"] = salvo
    r_segundo = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_segundo.status_code == 200, r_segundo.text
    assert r_segundo.json()["data_bloqueio_palpites_especiais"] == salvo
    assert r_segundo.json()["pontos_campeao"] == payload["pontos_campeao"]


def test_palpites_especiais_bloqueados(client) -> None:
    db = SessionLocal()
    try:
        _, user_id = seed_admin_e_usuario(db)
        user = usuario_service.get_by_id(db, user_id)
        assert user is not None and user.empresa_id is not None
        seed_config_com_bloqueio_especiais(db, user.empresa_id)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={"campeao_id": None},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Palpites especiais bloqueados"


def test_admin_trava_especiais_antes_do_prazo(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    admin_token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h_admin = {"Authorization": f"Bearer {admin_token}"}
    h_user = {"Authorization": f"Bearer {user_token}"}

    payload = _payload_configuracao(client, admin_token)
    payload["data_bloqueio_palpites_especiais"] = (
        datetime.now(UTC) + timedelta(days=7)
    ).replace(microsecond=0).isoformat()
    assert client.put("/configuracao-bolao", headers=h_admin, json=payload).status_code == 200

    r_patch = _patch_override(client, admin_token, "travado")
    assert r_patch.status_code == 200, r_patch.text

    r_post = client.post("/palpites-especiais", headers=h_user, json={"campeao_id": None})
    assert r_post.status_code == 400


def test_admin_destrava_especiais_apos_prazo(client) -> None:
    db = SessionLocal()
    try:
        _, user_id = seed_admin_e_usuario(db)
        user = usuario_service.get_by_id(db, user_id)
        assert user is not None and user.empresa_id is not None
        seed_config_com_bloqueio_especiais(db, user.empresa_id)
    finally:
        db.close()

    admin_token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")

    r_patch = _patch_override(client, admin_token, "destravado")
    assert r_patch.status_code == 200, r_patch.text

    r_post = client.post(
        "/palpites-especiais",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"campeao_id": None},
    )
    assert r_post.status_code == 201, r_post.text


def test_admin_restaura_automatico(client) -> None:
    db = SessionLocal()
    try:
        _, user_id = seed_admin_e_usuario(db)
        user = usuario_service.get_by_id(db, user_id)
        assert user is not None and user.empresa_id is not None
        seed_config_com_bloqueio_especiais(db, user.empresa_id)
    finally:
        db.close()

    admin_token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h_user = {"Authorization": f"Bearer {user_token}"}

    assert _patch_override(client, admin_token, "destravado").status_code == 200
    r_auto = _patch_override(client, admin_token, "automatico")
    assert r_auto.status_code == 200, r_auto.text
    assert r_auto.json()["override_bloqueio_palpites_especiais"] is None

    r_post = client.post("/palpites-especiais", headers=h_user, json={"campeao_id": None})
    assert r_post.status_code == 400


def test_participante_nao_pode_patch_override(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")
    r = _patch_override(client, user_token, "travado")
    assert r.status_code == 403


def test_owner_nao_pode_patch_override(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    owner_token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    r = _patch_override(client, owner_token, "travado")
    assert r.status_code == 403


def test_put_config_sem_marcadores_br_quando_desabilitado(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa = empresa_service.create_empresa(
            db,
            EmpresaCreate(
                nome="Sem Marcadores Bloqueio",
                codigo_empresa="SMB",
                marcadores_brasil_habilitado=False,
                max_usuarios=100,
            ),
        )
        usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Admin SMB",
                email="admin-smb@example.com",
                senha_plana="senhaadminsmb1",
                funcao="Admin",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa.id,
            ),
        )
    finally:
        db.close()

    token = _login(client, "admin-smb@example.com", "senhaadminsmb1")
    h = {"Authorization": f"Bearer {token}"}
    payload = _payload_configuracao(client, token)
    payload.pop("pontos_marcador_brasil", None)
    payload.pop("pontos_marcador_brasil_com_quantidade", None)

    r_put = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_put.status_code == 200, r_put.text


def test_get_config_minha_expoe_override_e_bloqueado(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    admin_token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")

    assert _patch_override(client, admin_token, "travado").status_code == 200

    r = client.get(
        "/configuracao-bolao/minha",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["override_bloqueio_palpites_especiais"] is True
    assert body["palpites_especiais_bloqueados"] is True


def test_palpite_grupo_bloqueado_1h_antes_primeiro_jogo_da_mesma_rodada(client) -> None:
    """Dois jogos na mesma rodada: palpite do 2º jogo fecha 1h antes do 1º."""
    from unittest.mock import patch

    from app.schemas.jogo import JogoCreate
    from app.services import jogo_service

    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        t_primeiro = datetime(2030, 6, 15, 18, 0, tzinfo=UTC)
        jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo A",
                grupo="A",
                tipo_fase="grupos",
                rodada=2,
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=t_primeiro,
            ),
        )
        j_tarde = jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo A",
                grupo="A",
                tipo_fase="grupos",
                rodada=2,
                pais_casa_id=b,
                pais_fora_id=a,
                data_jogo=t_primeiro + timedelta(hours=6),
            ),
        )
        jid = j_tarde.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    agora_bloq = t_primeiro - timedelta(minutes=30)
    with patch("app.services.regra_negocio.agora_utc", return_value=agora_bloq):
        r = client.post(
            "/palpites-jogos",
            headers=h,
            json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0},
        )
    assert r.status_code == 409, r.text


def test_marcadores_brasil_sem_jogo_brasil_retorna_erro(client) -> None:
    from app.schemas.jogo import JogoCreate
    from app.services import jogo_service

    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo Z",
                grupo="Z",
                tipo_fase="grupos",
                rodada=1,
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=datetime.now(UTC) + timedelta(days=5),
            ),
        )
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get(f"/marcadores-brasil/me/{jid}", headers=h)
    assert r.status_code == 400
