"""Etapa 13 — ranking agregado acessível e consistente."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_config, seed_dois_paises, seed_jogo_grupo_em_breve


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_ranking_retorna_linhas_ordenadas(client) -> None:
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
    assert client.post("/palpites-jogos", headers=uh, json={"jogo_id": jid, "palpite_casa": 0, "palpite_fora": 0}).status_code == 201

    r = client.get("/ranking", headers=uh)
    assert r.status_code == 200
    data = r.json()
    assert "linhas" in data
    linhas = data["linhas"]
    assert len(linhas) >= 1
    assert linhas[0]["posicao"] == 1
    for ln in linhas:
        assert ln["pontos_totais"] == ln["pontos_jogos"] + ln["bonus_brasil"] + ln["pontos_especiais"]
