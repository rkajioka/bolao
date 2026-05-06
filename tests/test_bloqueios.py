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
