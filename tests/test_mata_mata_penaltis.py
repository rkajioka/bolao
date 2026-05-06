"""Etapa 13 — mata-mata com prorrogação e pênaltis (persistência + finalização)."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import (
    seed_admin_e_usuario,
    seed_config,
    seed_dois_paises,
    seed_jogo_mata_mata,
    finalizar_jogo_mata_mata_com_penaltis,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_mata_mata_penaltis_e_classificado(client) -> None:
    db = SessionLocal()
    try:
        seed_config(db)
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_mata_mata(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    ut = _login(client, "user-etapa13@example.com", "senhausuario1")
    uh = {"Authorization": f"Bearer {ut}"}
    r0 = client.post(
        "/palpites-jogos",
        headers=uh,
        json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 1, "palpite_classificado_id": a},
    )
    assert r0.status_code == 201, r0.text

    at = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    ah = {"Authorization": f"Bearer {at}"}

    db = SessionLocal()
    try:
        from app.services import jogo_service

        j = jogo_service.get_by_id(db, jid)
        assert j is not None
        j = finalizar_jogo_mata_mata_com_penaltis(db, j, 1, 1, a)
        assert j.foi_para_penaltis is True
        assert j.teve_prorrogacao is True
        assert j.penaltis_casa == 4
        assert j.penaltis_fora == 5
    finally:
        db.close()

    r = client.get("/jogos/mata-mata", headers=uh)
    assert r.status_code == 200
    item = next(x for x in r.json() if x["id"] == jid)
    assert item["finalizado"] is True
    assert item["foi_para_penaltis"] is True

    r3 = client.get("/palpites-jogos/me", headers=uh)
    palpite = next(p for p in r3.json() if p["jogo_id"] == jid)
    assert palpite["pontuacao_classificado"] >= 7
