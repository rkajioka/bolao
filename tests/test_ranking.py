"""Etapa 13 — ranking agregado acessível e consistente."""

from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate
from app.services import usuario_service
from tests.factories import seed_admin_e_usuario, seed_dois_paises, seed_jogo_grupo_em_breve


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_ranking_retorna_linhas_ordenadas(client) -> None:
    db = SessionLocal()
    try:
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


def test_ranking_exclui_usuario_aguardando_ativacao(client) -> None:
    db = SessionLocal()
    aguardando_id: int
    ativado_id: int
    try:
        seed_admin_e_usuario(db)
        empresa_id = db.scalar(
            select(Usuario.empresa_id).where(Usuario.email == "user-etapa13@example.com")
        )
        ativado_id = db.scalar(select(Usuario.id).where(Usuario.email == "user-etapa13@example.com"))
        aguardando, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="aguardando.ranking@example.com",
                email="aguardando.ranking@example.com",
                senha_plana="senhaaguardando1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=True,
                empresa_id=empresa_id,
            ),
        )
        aguardando_id = aguardando.id
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    headers = {"Authorization": f"Bearer {token}"}
    assert (
        client.post(
            "/palpites-jogos",
            headers=headers,
            json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0},
        ).status_code
        == 201
    )

    r = client.get("/ranking", headers=headers)
    assert r.status_code == 200
    linhas = r.json()["linhas"]
    ids = {ln["usuario_id"] for ln in linhas}
    assert ativado_id in ids
    assert aguardando_id not in ids
    assert not any(ln["nome"] == "aguardando.ranking@example.com" for ln in linhas)
