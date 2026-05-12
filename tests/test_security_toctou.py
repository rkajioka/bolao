"""SEC-007 — revalidação de prazo no commit (TOCTOU)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from app.database import SessionLocal
from app.schemas.jogo import JogoCreate
from app.services import candidato_marcador_brasil_service, jogo_service
from app.schemas.candidato_marcador_brasil import CandidatoMarcadorBrasilCreate
from tests.factories import (
    seed_admin_e_usuario,
    seed_brasil_e_adversario,
    seed_dois_paises,
    seed_jogo_brasil_em_breve,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_palpite_revalida_prazo_no_commit(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        t_inicio = datetime(2030, 6, 15, 18, 0, tzinfo=UTC)
        jogo = jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo A",
                grupo="A",
                tipo_fase="grupos",
                rodada=2,
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=t_inicio,
            ),
        )
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    antes = t_inicio - timedelta(hours=2)
    depois = t_inicio - timedelta(minutes=30)
    with patch("app.services.regra_negocio.agora_utc", side_effect=[antes, depois]):
        r = client.post(
            "/palpites-jogos",
            headers=h,
            json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0},
        )
    assert r.status_code == 409, r.text


def test_marcadores_revalida_prazo_no_commit(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        br, fora = seed_brasil_e_adversario(db)
        jogo = seed_jogo_brasil_em_breve(db, br, fora)
        jid = jogo.id
        candidato_marcador_brasil_service.criar(
            db,
            CandidatoMarcadorBrasilCreate(nome="Jogador A"),
        )
        t_inicio = jogo.data_jogo
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    assert (
        client.post(
            "/palpites-jogos",
            headers=h,
            json={"jogo_id": jid, "palpite_casa": 2, "palpite_fora": 0},
        ).status_code
        == 201
    )

    antes = t_inicio - timedelta(hours=2)
    depois = t_inicio - timedelta(minutes=30)
    with patch("app.services.regra_negocio.agora_utc", side_effect=[antes, depois]):
        r = client.put(
            f"/marcadores-brasil/{jid}",
            headers=h,
            json={"marcadores": [{"nome_jogador": "Jogador A", "quantidade_gols": 1}, {"nome_jogador": "Jogador A", "quantidade_gols": 1}]},
        )
    assert r.status_code == 409, r.text
