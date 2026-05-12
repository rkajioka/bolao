"""Insights do ranking por bloco fechado e por empresa."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models.jogo import Jogo
from app.models.usuario import Usuario
from app.schemas.empresa import EmpresaCreate
from app.schemas.jogo import JogoCreate
from app.schemas.usuario import UsuarioCreate
from app.services import empresa_service, jogo_service, usuario_service
from tests.factories import (
    finalizar_jogo,
    finalizar_jogo_mata_mata_com_penaltis,
    seed_dois_paises,
    seed_jogo_mata_mata,
    seed_owner_admin_e_usuario,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _seed_jogo_grupo_rodada(db, casa_id: int, fora_id: int, rodada: int) -> Jogo:
    return jogo_service.create_jogo(
        db,
        JogoCreate(
            fase=f"Grupo R{rodada}",
            grupo="A",
            tipo_fase="grupos",
            rodada=rodada,
            pais_casa_id=casa_id,
            pais_fora_id=fora_id,
            data_jogo=datetime.now(UTC) + timedelta(days=rodada),
        ),
    )


def _insights(client, token: str, empresa_id: int | None = None) -> dict:
    qs = f"?empresa_id={empresa_id}" if empresa_id is not None else ""
    r = client.get(f"/ranking/insights{qs}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()


def test_r1_parcial_aguarda_primeiro_bloco(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        _seed_jogo_grupo_rodada(db, b, a, 1)
        finalizar_jogo(db, j1, 1, 0)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_status"] == "aguardando_primeiro_bloco"
    assert body["jogos_periodo"] == 0
    assert body["metricas_empresa"] == []


def test_r1_fechada_disponivel(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        j2 = _seed_jogo_grupo_rodada(db, b, a, 1)
        finalizar_jogo(db, j1, 1, 0)
        finalizar_jogo(db, j2, 0, 0)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_status"] == "disponivel"
    assert body["periodo_chave"] == "grupo_rodada_1"
    assert body["jogos_periodo"] == 2
    assert body["periodo_em_andamento_label"] is None


def test_r1_fechada_r2_parcial_bloco_em_andamento(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        j2 = _seed_jogo_grupo_rodada(db, b, a, 1)
        finalizar_jogo(db, j1, 1, 0)
        finalizar_jogo(db, j2, 0, 0)
        j3 = _seed_jogo_grupo_rodada(db, a, b, 2)
        _seed_jogo_grupo_rodada(db, b, a, 2)
        finalizar_jogo(db, j3, 2, 1)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_status"] == "bloco_em_andamento"
    assert body["periodo_chave"] == "grupo_rodada_1"
    assert body["jogos_periodo"] == 2
    assert body["periodo_em_andamento_label"] == "Grupos - Rodada 2"


def test_r1_fechada_sem_jogos_r2_disponivel(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        j2 = _seed_jogo_grupo_rodada(db, b, a, 1)
        finalizar_jogo(db, j1, 1, 0)
        finalizar_jogo(db, j2, 0, 0)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_status"] == "disponivel"
    assert body["periodo_em_andamento_label"] is None


def test_mata_mata_oitavas_fechada(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_mata_mata(db, a, b)
        finalizar_jogo_mata_mata_com_penaltis(db, jogo, 1, 1, b)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_chave"] == "oitavas"
    assert body["periodo_tipo"] == "fase_mata_mata"


def test_payload_sem_marcadores_br(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = _seed_jogo_grupo_rodada(db, a, b, 1)
        finalizar_jogo(db, jogo, 1, 0)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert "destaques_marcadores_br" not in body
    assert "meu_bonus_marcadores_br" not in body
    assert "destaques_usuarios" in body


def test_insights_isolam_empresa_nos_destaques(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa_a_id = db.scalar(select(Usuario.empresa_id).where(Usuario.email == "user-etapa13@example.com"))
        empresa_b = empresa_service.create_empresa(
            db, EmpresaCreate(nome="Empresa B", codigo_empresa="INSB", max_usuarios=100)
        )
        empresa_b_id = empresa_b.id
        usuario_service.create_usuario(
            db,
            UsuarioCreate.model_construct(
                nome="Usuário B",
                email="user-insights-b@example.com",
                senha_plana="senhausuario1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_b_id,
            ),
        )
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        finalizar_jogo(db, j1, 1, 0)
    finally:
        db.close()

    token_owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    body_a = _insights(client, token_owner, empresa_a_id)
    body_b = _insights(client, token_owner, empresa_b_id)
    nomes_a = {d["nome"] for d in body_a["destaques_usuarios"]["resultado"]}
    nomes_b = {d["nome"] for d in body_b["destaques_usuarios"]["resultado"]}
    assert "Usuário B" not in nomes_a
    assert "Usuário Teste" not in nomes_b


def test_minha_posicao_periodo_com_palpite(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = _seed_jogo_grupo_rodada(db, a, b, 1)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.post("/palpites-jogos", headers=h, json={"jogo_id": jid, "palpite_casa": 2, "palpite_fora": 1}).status_code == 201

    db = SessionLocal()
    try:
        jogo = db.get(Jogo, jid)
        assert jogo is not None
        finalizar_jogo(db, jogo, 2, 1)
    finally:
        db.close()

    body = _insights(client, token)
    assert body["minha_posicao_periodo"] == 1
    assert body["meus_pontos_periodo"] > 0


def test_metricas_contam_resultado_correto_incluindo_placar_exato(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        j1 = _seed_jogo_grupo_rodada(db, a, b, 1)
        j2 = _seed_jogo_grupo_rodada(db, b, a, 1)
        jogo_ids = [j1.id, j2.id]
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.post("/palpites-jogos", headers=h, json={"jogo_id": jogo_ids[0], "palpite_casa": 0, "palpite_fora": 0}).status_code == 201
    assert client.post("/palpites-jogos", headers=h, json={"jogo_id": jogo_ids[1], "palpite_casa": 1, "palpite_fora": 0}).status_code == 201

    db = SessionLocal()
    try:
        finalizar_jogo(db, db.get(Jogo, jogo_ids[0]), 0, 0)
        finalizar_jogo(db, db.get(Jogo, jogo_ids[1]), 1, 0)
    finally:
        db.close()

    body = _insights(client, token)
    metricas = {item["chave"]: item for item in body["metricas_empresa"]}
    assert metricas["pessoas_placar_exato"]["valor"] >= 1
    assert metricas["pessoas_resultado"]["valor"] >= 1
    assert metricas["total_placares_exatos"]["valor"] >= 2
    assert metricas["total_acertos_resultado"]["valor"] >= 2
    assert body["meu_acertos_placar_exato"] >= 2
    assert body["meu_acertos_resultado"] >= 2


def test_fase_mata_mata_ilegivel_nao_quebra_bloco_valido(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo_valido = seed_jogo_mata_mata(db, a, b)
        finalizar_jogo_mata_mata_com_penaltis(db, jogo_valido, 1, 1, b)
        db.add(
            Jogo(
                fase="Fase Estranha",
                grupo=None,
                tipo_fase="mata_mata",
                rodada=None,
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=datetime.now(UTC) + timedelta(days=1),
                finalizado=True,
                placar_casa=1,
                placar_fora=0,
            )
        )
        db.commit()
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    body = _insights(client, token)
    assert body["periodo_chave"] == "oitavas"
    assert body["jogos_periodo"] == 1
