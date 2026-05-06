"""Etapa 13 — bloqueios de palpites, especiais e marcadores."""

from __future__ import annotations

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


def test_palpites_especiais_bloqueados(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        seed_config_com_bloqueio_especiais(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={"campeao_id": None, "melhor_jogador": "x"},
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
