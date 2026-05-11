from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_dois_paises


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_palpite_com_placar_absurdo_retorna_422(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        casa, fora = seed_dois_paises(db)
    finally:
        db.close()

    admin_token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h_admin = {"Authorization": f"Bearer {admin_token}"}
    r_jogo = client.post(
        "/jogos",
        headers=h_admin,
        json={
            "fase": "Grupo A - Rodada 1",
            "grupo": "A",
            "tipo_fase": "grupos",
            "rodada": 1,
            "pais_casa_id": casa,
            "pais_fora_id": fora,
            "data_jogo": "2030-06-01T18:00:00+00:00",
        },
    )
    assert r_jogo.status_code == 201, r_jogo.text
    jogo_id = r_jogo.json()["id"]

    user_token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h_user = {"Authorization": f"Bearer {user_token}"}
    r = client.post(
        "/palpites-jogos",
        headers=h_user,
        json={"jogo_id": jogo_id, "palpite_casa": 99, "palpite_fora": 0},
    )
    assert r.status_code == 422


def test_marcador_com_quantidade_absurda_retorna_422(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/marcadores-brasil/1",
        headers=h,
        json={"marcadores": [{"nome_jogador": "Jogador X", "quantidade_gols": 99}]},
    )
    assert r.status_code == 422
