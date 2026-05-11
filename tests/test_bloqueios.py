"""Etapa 13 — bloqueios de palpites, especiais e marcadores."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from tests.factories import (
    seed_admin_e_usuario,
    seed_config_com_bloqueio_especiais,
    seed_dois_paises,
    seed_jogo_grupo_passado,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


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
    assert r.status_code == 400


def _payload_configuracao(client, token: str) -> dict:
    r = client.get("/configuracao-bolao", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    return {
        k: body[k]
        for k in body
        if k not in {"id", "created_at", "updated_at", "empresa_id", "marcadores_brasil_habilitado"}
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


def test_admin_nao_pode_alterar_bloqueio_especiais_apos_definido(client) -> None:
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
    assert client.put("/configuracao-bolao", headers=h, json=payload).status_code == 200

    payload["data_bloqueio_palpites_especiais"] = (
        datetime.now(UTC) + timedelta(days=14)
    ).replace(microsecond=0).isoformat()
    r_put = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_put.status_code == 400
    assert r_put.json()["detail"] == (
        "A data de bloqueio dos palpites especiais já foi definida e não pode mais ser alterada"
    )


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
        from app.services import usuario_service

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


def test_palpite_grupo_bloqueado_1h_antes_primeiro_jogo_da_mesma_rodada(client) -> None:
    """Dois jogos na mesma rodada: palpite do 2º jogo fecha 1h antes do 1º."""
    from datetime import UTC, datetime, timedelta
    from unittest.mock import patch

    from app.database import SessionLocal
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
    with patch("app.services.palpite_jogo_service._agora_utc", return_value=agora_bloq):
        r = client.post(
            "/palpites-jogos",
            headers=h,
            json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0},
        )
    assert r.status_code == 400, r.text


def test_marcadores_brasil_sem_jogo_brasil_retorna_erro(client) -> None:
    from datetime import UTC, datetime, timedelta

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
