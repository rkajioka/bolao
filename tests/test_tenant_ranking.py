"""Isolamento de ranking/insights por empresa e criação de empresa."""

from __future__ import annotations

from sqlalchemy import select

from app.database import SessionLocal
from app.models.configuracao_bolao import ConfiguracaoBolao
from app.models.empresa_tema import EmpresaTema
from app.models.pontuacao_fase import PontuacaoFase
from app.models.usuario import Usuario
from app.schemas.empresa import EmpresaCreate
from app.schemas.usuario import UsuarioCreate
from app.services import empresa_service, usuario_service
from tests.factories import seed_dois_paises, seed_jogo_grupo_em_breve, seed_owner_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_owner_ranking_exige_empresa_id(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get("/ranking", headers=h)
    assert r.status_code == 400
    r_insights = client.get("/ranking/insights", headers=h)
    assert r_insights.status_code == 400


def test_owner_ranking_filtra_por_empresa(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa_a_id = db.scalar(select(Usuario.empresa_id).where(Usuario.email == "user-etapa13@example.com"))
        empresa_b = empresa_service.create_empresa(
            db, EmpresaCreate(nome="Empresa B", codigo_empresa="EMPB")
        )
        empresa_b_id = empresa_b.id
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Usuário B",
                email="user-b@example.com",
                senha_plana="senhausuario1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_b_id,
            ),
        )
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    token_b = _login(client, "user-b@example.com", "senhausuario1")
    hb = {"Authorization": f"Bearer {token_b}"}
    assert (
        client.post(
            "/palpites-jogos",
            headers=hb,
            json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0},
        ).status_code
        == 201
    )

    token_owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    ho = {"Authorization": f"Bearer {token_owner}"}

    r_a = client.get(f"/ranking?empresa_id={empresa_a_id}", headers=ho)
    assert r_a.status_code == 200
    nomes_a = {ln["nome"] for ln in r_a.json()["linhas"]}
    assert "Usuário B" not in nomes_a
    assert "Usuário Teste" in nomes_a

    r_b = client.get(f"/ranking?empresa_id={empresa_b_id}", headers=ho)
    assert r_b.status_code == 200
    assert all(ln["nome"] != "Usuário Teste" for ln in r_b.json()["linhas"])
    assert any(ln["nome"] == "Usuário B" for ln in r_b.json()["linhas"])


def test_membro_ignora_empresa_id_na_query(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa_b = empresa_service.create_empresa(
            db, EmpresaCreate(nome="Empresa B", codigo_empresa="EMP2")
        )
        empresa_b_id = empresa_b.id
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Usuário B",
                email="user-b2@example.com",
                senha_plana="senhausuario1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_b_id,
            ),
        )
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.get(f"/ranking?empresa_id={empresa_b_id}", headers=h)
    assert r.status_code == 200
    nomes = {ln["nome"] for ln in r.json()["linhas"]}
    assert "Usuário B" not in nomes
    assert "Usuário Teste" in nomes


def test_insights_respeitam_empresa_id(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa_a_id = db.scalar(select(Usuario.empresa_id).where(Usuario.email == "user-etapa13@example.com"))
        empresa_b = empresa_service.create_empresa(
            db, EmpresaCreate(nome="Empresa B", codigo_empresa="EMP3")
        )
        empresa_b_id = empresa_b.id
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Usuário B",
                email="user-b3@example.com",
                senha_plana="senhausuario1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_b_id,
            ),
        )
    finally:
        db.close()

    token_owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    ho = {"Authorization": f"Bearer {token_owner}"}

    r_a = client.get(f"/ranking/insights?empresa_id={empresa_a_id}", headers=ho)
    assert r_a.status_code == 200
    nomes_a = {d["nome"] for d in r_a.json()["destaques_resultado"]}
    assert "Usuário B" not in nomes_a

    r_b = client.get(f"/ranking/insights?empresa_id={empresa_b_id}", headers=ho)
    assert r_b.status_code == 200
    nomes_b = {d["nome"] for d in r_b.json()["destaques_resultado"]}
    assert "Usuário Teste" not in nomes_b


def test_post_empresas_cria_bootstrap(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/empresas/",
        headers=h,
        json={"nome": "Nova Corp"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    empresa_id = body["id"]
    assert body["codigo_empresa"] == "NOVA_CORP"

    db = SessionLocal()
    try:
        cfg = db.scalar(
            select(ConfiguracaoBolao).where(ConfiguracaoBolao.empresa_id == empresa_id).limit(1)
        )
        assert cfg is not None
        fases = list(
            db.scalars(select(PontuacaoFase).where(PontuacaoFase.empresa_id == empresa_id)).all()
        )
        assert len(fases) > 0
        tema = db.scalar(select(EmpresaTema).where(EmpresaTema.empresa_id == empresa_id).limit(1))
        assert tema is not None
    finally:
        db.close()


def test_post_empresas_gera_codigo_automatico_e_unico(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}

    r1 = client.post("/empresas/", headers=h, json={"nome": "LPC Latina"})
    assert r1.status_code == 201, r1.text
    assert r1.json()["codigo_empresa"] == "LPC_LATINA"

    r2 = client.post("/empresas/", headers=h, json={"nome": "LPC Latina"})
    assert r2.status_code == 201, r2.text
    assert r2.json()["codigo_empresa"] == "LPC_LATINA_2"
