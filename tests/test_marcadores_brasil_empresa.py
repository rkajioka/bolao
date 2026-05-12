"""Bônus de marcadores do Brasil por empresa (tenant)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.database import SessionLocal
from app.schemas.candidato_marcador_brasil import CandidatoMarcadorBrasilCreate
from app.schemas.empresa import EmpresaCreate
from app.schemas.jogo import JogoCreate, JogoResultadoPatch
from app.schemas.marcador_brasil import (
    MarcadorBrasilPalpiteItem,
    MarcadorBrasilResultadoBase,
    MarcadoresBrasilResultadoSync,
)
from app.schemas.pais import PaisCreate
from app.schemas.palpite_jogo import PalpiteJogoCreate
from app.schemas.usuario import UsuarioCreate
from app.services import (
    candidato_marcador_brasil_service,
    empresa_service,
    jogo_service,
    marcador_brasil_service,
    pais_service,
    palpite_jogo_service,
    pontuacao_service,
    usuario_service,
)
from tests.factories import finalizar_jogo, seed_owner_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _finalizar_jogo_com_marcadores_resultado(
    db,
    jogo_id: int,
    placar_casa: int,
    placar_fora: int,
    marcadores: MarcadoresBrasilResultadoSync,
) -> None:
    jogo = jogo_service.get_by_id(db, jogo_id)
    assert jogo is not None
    jogo_service.patch_resultado(
        db,
        jogo,
        JogoResultadoPatch(placar_casa=placar_casa, placar_fora=placar_fora),
    )
    marcador_brasil_service.sincronizar_marcadores_resultado_admin(db, jogo_id, marcadores)
    jogo = jogo_service.get_by_id(db, jogo_id)
    assert jogo is not None
    jogo.data_jogo = datetime.now(UTC) - timedelta(hours=3)
    db.commit()
    db.refresh(jogo)
    jogo_service.patch_finalizar(db, jogo)


def _seed_jogo_brasil(db) -> int:
    br = pais_service.create_pais(
        db,
        PaisCreate(nome="Brasil", sigla="BR", bandeira_url="https://example.com/br.png", grupo="A"),
    )
    outro = pais_service.create_pais(
        db,
        PaisCreate(nome="França", sigla="FR", bandeira_url="https://example.com/fr.png", grupo="A"),
    )
    jogo = jogo_service.create_jogo(
        db,
        JogoCreate(
            fase="Grupo A",
            grupo="A",
            tipo_fase="grupos",
            rodada=1,
            pais_casa_id=br.id,
            pais_fora_id=outro.id,
            data_jogo=datetime.now(UTC) + timedelta(days=3),
        ),
    )
    candidato_marcador_brasil_service.criar(
        db, CandidatoMarcadorBrasilCreate(nome="Neymar")
    )
    return jogo.id


def test_nova_empresa_flag_false_exposta_em_config_minha(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h_owner = _headers(owner)

    r_create = client.post(
        "/empresas/",
        headers=h_owner,
        json={"nome": "Sem Marcadores", "marcadores_brasil_habilitado": False, "max_usuarios": 100},
    )
    assert r_create.status_code == 201, r_create.text
    empresa_id = r_create.json()["id"]

    db = SessionLocal()
    try:
        admin, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Admin Off",
                email="admin-off@example.com",
                senha_plana="senhaadminoff1",
                funcao="Admin",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_id,
            ),
        )
        user, _ = usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="User Off",
                email="user-off@example.com",
                senha_plana="senhausuariooff1",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa_id,
            ),
        )
        _ = admin.id, user.id
    finally:
        db.close()

    for email, senha in (
        ("admin-off@example.com", "senhaadminoff1"),
        ("user-off@example.com", "senhausuariooff1"),
    ):
        token = _login(client, email, senha)
        r_cfg = client.get("/configuracao-bolao/minha", headers=_headers(token))
        assert r_cfg.status_code == 200, r_cfg.text
        assert r_cfg.json()["marcadores_brasil_habilitado"] is False


def test_participante_marcadores_403_quando_feature_off(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa = empresa_service.create_empresa(
            db,
            EmpresaCreate(
                nome="Empresa Off",
                codigo_empresa="OFF",
                marcadores_brasil_habilitado=False,
                max_usuarios=100,
            ),
        )
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="User Off 2",
                email="user-off2@example.com",
                senha_plana="senhausuariooff2",
                funcao="Jogador",
                tipo_usuario="usuario",
                ativo=True,
                primeiro_login=False,
                empresa_id=empresa.id,
            ),
        )
        jogo_id = _seed_jogo_brasil(db)
    finally:
        db.close()

    token = _login(client, "user-off2@example.com", "senhausuariooff2")
    h = _headers(token)
    detail = "Bônus de marcadores desabilitado no bolão."

    r_cand = client.get("/marcadores-brasil/candidatos", headers=h)
    assert r_cand.status_code == 403
    assert r_cand.json()["detail"] == detail

    r_me = client.get(f"/marcadores-brasil/me/{jogo_id}", headers=h)
    assert r_me.status_code == 403
    assert r_me.json()["detail"] == detail

    r_put = client.put(
        f"/marcadores-brasil/{jogo_id}",
        headers=h,
        json={"marcadores": [{"nome_jogador": "Neymar", "quantidade_gols": 1}]},
    )
    assert r_put.status_code == 403
    assert r_put.json()["detail"] == detail


def test_put_config_ignora_pontos_marcador_quando_feature_off(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa = empresa_service.get_by_codigo(db, "TESTE")
        assert empresa is not None
        empresa.marcadores_brasil_habilitado = False
        db.commit()
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = _headers(token)

    r_before = client.get("/configuracao-bolao", headers=h)
    assert r_before.status_code == 200
    antes = r_before.json()
    assert antes["marcadores_brasil_habilitado"] is False

    payload = {
        **{k: antes[k] for k in antes if k not in {"id", "created_at", "updated_at", "empresa_id"}},
        "pontos_marcador_brasil": 99,
        "pontos_marcador_brasil_com_quantidade": 88,
    }
    r_put = client.put("/configuracao-bolao", headers=h, json=payload)
    assert r_put.status_code == 200, r_put.text
    depois = r_put.json()
    assert depois["pontos_marcador_brasil"] == antes["pontos_marcador_brasil"]
    assert depois["pontos_marcador_brasil_com_quantidade"] == antes["pontos_marcador_brasil_com_quantidade"]


def test_pontuacao_marcadores_zero_quando_feature_off(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa = empresa_service.get_by_codigo(db, "TESTE")
        assert empresa is not None
        empresa.marcadores_brasil_habilitado = False
        db.commit()
        jogo_id = _seed_jogo_brasil(db)
        user = usuario_service.get_by_email(db, "user-etapa13@example.com")
        assert user is not None
        palpite_jogo_service.create_palpite(
            db,
            user.id,
            PalpiteJogoCreate(jogo_id=jogo_id, palpite_casa=2, palpite_fora=0),
        )
        _finalizar_jogo_com_marcadores_resultado(
            db,
            jogo_id,
            2,
            0,
            MarcadoresBrasilResultadoSync(
                marcadores=[MarcadorBrasilResultadoBase(nome_jogador="Neymar", quantidade_gols=1)]
            ),
        )
        palpite = palpite_jogo_service.get_by_usuario_jogo(db, user.id, jogo_id)
        assert palpite is not None
        assert palpite.pontuacao_marcadores_brasil == 0
    finally:
        db.close()


def test_patch_empresa_desliga_recalcula_ranking_sem_bonus(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        jogo_id = _seed_jogo_brasil(db)
        user = usuario_service.get_by_email(db, "user-etapa13@example.com")
        assert user is not None
        palpite_jogo_service.create_palpite(
            db,
            user.id,
            PalpiteJogoCreate(jogo_id=jogo_id, palpite_casa=1, palpite_fora=0),
        )
        marcador_brasil_service.sincronizar_marcadores_palpite(
            db,
            user.id,
            jogo_id,
            [MarcadorBrasilPalpiteItem(nome_jogador="Neymar", quantidade_gols=1)],
            empresa_id=user.empresa_id,
        )
        _finalizar_jogo_com_marcadores_resultado(
            db,
            jogo_id,
            1,
            0,
            MarcadoresBrasilResultadoSync(
                marcadores=[MarcadorBrasilResultadoBase(nome_jogador="Neymar", quantidade_gols=1)]
            ),
        )
        palpite = palpite_jogo_service.get_by_usuario_jogo(db, user.id, jogo_id)
        assert palpite is not None
        assert palpite.pontuacao_marcadores_brasil > 0
        empresa = empresa_service.get_by_id(db, user.empresa_id)
        assert empresa is not None
        empresa_id = empresa.id
        user_id = user.id
    finally:
        db.close()

    owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    r_patch = client.patch(
        f"/empresas/{empresa_id}",
        headers=_headers(owner),
        json={"marcadores_brasil_habilitado": False},
    )
    assert r_patch.status_code == 200, r_patch.text

    db = SessionLocal()
    try:
        palpite = palpite_jogo_service.get_by_usuario_jogo(db, user_id, jogo_id)
        assert palpite is not None
        assert palpite.pontuacao_marcadores_brasil == 0
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    r_rank = client.get("/ranking", headers=_headers(token))
    assert r_rank.status_code == 200
    linha = next(x for x in r_rank.json()["linhas"] if x["usuario_id"] == user_id)
    assert linha["bonus_brasil"] == 0


def test_owner_candidatos_independente_do_flag_empresa(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        empresa = empresa_service.get_by_codigo(db, "TESTE")
        assert empresa is not None
        empresa.marcadores_brasil_habilitado = False
        db.commit()
        candidato_marcador_brasil_service.criar(
            db, CandidatoMarcadorBrasilCreate(nome="Richarlison")
        )
    finally:
        db.close()

    owner = _login(client, "owner-etapa13@example.com", "senhaowner1")
    r = client.get("/marcadores-brasil/candidatos/admin", headers=_headers(owner))
    assert r.status_code == 200
    nomes = {row["nome"] for row in r.json()}
    assert "Richarlison" in nomes


def test_marcadores_palpite_exige_um_por_gol() -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        jogo_id = _seed_jogo_brasil(db)
        user = usuario_service.get_by_email(db, "user-etapa13@example.com")
        assert user is not None
        palpite_jogo_service.create_palpite(
            db,
            user.id,
            PalpiteJogoCreate(jogo_id=jogo_id, palpite_casa=2, palpite_fora=0),
        )
        with pytest.raises(ValueError, match="exatamente 2 marcador"):
            marcador_brasil_service.sincronizar_marcadores_palpite(
                db,
                user.id,
                jogo_id,
                [MarcadorBrasilPalpiteItem(nome_jogador="Neymar", quantidade_gols=1)],
                empresa_id=user.empresa_id,
            )
        salvos = marcador_brasil_service.sincronizar_marcadores_palpite(
            db,
            user.id,
            jogo_id,
            [
                MarcadorBrasilPalpiteItem(nome_jogador="Neymar", quantidade_gols=1),
                MarcadorBrasilPalpiteItem(nome_jogador="Neymar", quantidade_gols=1),
            ],
            empresa_id=user.empresa_id,
        )
        assert len(salvos) == 2
        assert all(row.quantidade_gols == 1 for row in salvos)
    finally:
        db.close()


def test_marcadores_palpite_rejeita_quantidade_diferente_de_um() -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        jogo_id = _seed_jogo_brasil(db)
        user = usuario_service.get_by_email(db, "user-etapa13@example.com")
        assert user is not None
        palpite_jogo_service.create_palpite(
            db,
            user.id,
            PalpiteJogoCreate(jogo_id=jogo_id, palpite_casa=2, palpite_fora=0),
        )
        with pytest.raises(ValueError, match="exatamente 1 gol"):
            marcador_brasil_service.sincronizar_marcadores_palpite(
                db,
                user.id,
                jogo_id,
                [MarcadorBrasilPalpiteItem(nome_jogador="Neymar", quantidade_gols=2)],
                empresa_id=user.empresa_id,
            )
    finally:
        db.close()
