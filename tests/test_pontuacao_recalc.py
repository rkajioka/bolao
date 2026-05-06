"""Etapa 13 — alteração de resultado / finalizar recalcula pontos."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_config, seed_dois_paises, seed_jogo_grupo_em_breve


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_finalizar_jogo_atualiza_pontuacao_placar(client) -> None:
    db = SessionLocal()
    try:
        seed_config(db)
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    ut = _login(client, "user-etapa13@example.com", "senhausuario1")
    uh = {"Authorization": f"Bearer {ut}"}
    r0 = client.post("/palpites-jogos", headers=uh, json={"jogo_id": jid, "palpite_casa": 2, "palpite_fora": 1})
    assert r0.status_code == 201, r0.text

    at = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    ah = {"Authorization": f"Bearer {at}"}
    r1 = client.patch(f"/jogos/{jid}/resultado", headers=ah, json={"placar_casa": 2, "placar_fora": 1})
    assert r1.status_code == 200, r1.text
    r2 = client.patch(f"/jogos/{jid}/finalizar", headers=ah)
    assert r2.status_code == 200, r2.text

    r3 = client.get("/palpites-jogos/me", headers=uh)
    assert r3.status_code == 200
    palpites = r3.json()
    alvo = next(p for p in palpites if p["jogo_id"] == jid)
    assert alvo["pontuacao_placar"] >= 10
    assert alvo["pontuacao_total"] >= 10


def test_alterar_resultado_apos_finalizar_recalcula(client) -> None:
    db = SessionLocal()
    try:
        seed_config(db)
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    ut = _login(client, "user-etapa13@example.com", "senhausuario1")
    uh = {"Authorization": f"Bearer {ut}"}
    assert client.post("/palpites-jogos", headers=uh, json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0}).status_code == 201

    at = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    ah = {"Authorization": f"Bearer {at}"}
    assert client.patch(f"/jogos/{jid}/resultado", headers=ah, json={"placar_casa": 1, "placar_fora": 0}).status_code == 200
    assert client.patch(f"/jogos/{jid}/finalizar", headers=ah).status_code == 200

    r_ok = client.get("/palpites-jogos/me", headers=uh)
    palpite = next(p for p in r_ok.json() if p["jogo_id"] == jid)
    assert palpite["pontuacao_placar"] >= 10

    assert client.patch(f"/jogos/{jid}/resultado", headers=ah, json={"placar_casa": 0, "placar_fora": 0}).status_code == 200

    r_new = client.get("/palpites-jogos/me", headers=uh)
    palpite2 = next(p for p in r_new.json() if p["jogo_id"] == jid)
    assert palpite2["pontuacao_placar"] == 0
