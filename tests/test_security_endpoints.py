"""Cobertura dos endurecimentos E-01 a E-17 (SECURITY.md)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.jogo import Jogo
from app.models.palpite_especial import PalpiteEspecial
from app.schemas.configuracao_bolao import ConfiguracaoBolaoWrite
from app.schemas.jogo import JogoUpdate
from tests.factories import (
    finalizar_jogo,
    seed_admin_e_usuario,
    seed_brasil_e_adversario,
    seed_config,
    seed_dois_paises,
    seed_jogo_brasil_em_breve,
    seed_jogo_grupo_em_breve,
    seed_owner_admin_e_usuario,
)


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_get_palpites_me_exige_autenticacao(client) -> None:
    assert client.get("/palpites-jogos/me").status_code == 401


def test_get_palpites_me_primeiro_login_bloqueado(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        from app.models.usuario import Usuario

        user = db.query(Usuario).filter(Usuario.email == "user-etapa13@example.com").one()
        user.primeiro_login = True
        db.commit()
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    r = client.get("/palpites-jogos/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_put_palpite_outro_usuario_retorna_404(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r_create = client.post("/palpites-jogos", headers=h, json={"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0})
    assert r_create.status_code == 201, r_create.text
    palpite_id = r_create.json()["id"]

    token_admin = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h_admin = {"Authorization": f"Bearer {token_admin}"}
    r_put = client.put(
        f"/palpites-jogos/{palpite_id}",
        headers=h_admin,
        json={"palpite_casa": 2, "palpite_fora": 1},
    )
    assert r_put.status_code == 404


def test_post_palpite_duplicado_retorna_409(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    body = {"jogo_id": jid, "palpite_casa": 1, "palpite_fora": 0}
    assert client.post("/palpites-jogos", headers=h, json=body).status_code == 201
    r_dup = client.post("/palpites-jogos", headers=h, json=body)
    assert r_dup.status_code == 409


def test_palpite_especial_sem_empresa_bloqueado(client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
        from app.models.usuario import Usuario

        user = db.get(Usuario, user_id)
        assert user is not None
        user.empresa_id = None
        db.commit()
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={
            "campeao_id": None,
            "vice_campeao_id": None,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
        },
    )
    assert r.status_code == 403


def test_palpite_especial_bloqueado_no_banco(client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
        db.add(
            PalpiteEspecial(
                usuario_id=user_id,
                campeao_id=None,
                vice_campeao_id=None,
                terceiro_lugar_id=None,
                artilheiro_pais_id=None,
                bloqueado=True,
            )
        )
        db.commit()
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.put(
        "/palpites-especiais/me",
        headers=h,
        json={"campeao_id": None},
    )
    assert r.status_code == 400


def test_owner_lista_palpites_especiais_globais(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/palpites-especiais", headers=h).status_code == 200
    assert client.get("/palpites-especiais", headers={"Authorization": "Bearer invalid"}).status_code == 401

    token_user = _login(client, "user-etapa13@example.com", "senhausuario1")
    assert client.get("/palpites-especiais", headers={"Authorization": f"Bearer {token_user}"}).status_code == 403


def test_owner_recalcula_palpites_especiais(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.patch("/palpites-especiais/recalcular", headers=h).status_code == 204


def test_get_jogos_autenticado(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    for path in ("/jogos", "/jogos/cronologico", "/jogos/grupos", "/jogos/mata-mata", "/jogos/brasil"):
        assert client.get(path, headers=h).status_code == 200, path


def test_patch_jogo_resultado_finalizado_retorna_409(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jogo = finalizar_jogo(db, jogo, 1, 0)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.patch(
        f"/jogos/{jid}/resultado",
        headers=h,
        json={"placar_casa": 2, "placar_fora": 1},
    )
    assert r.status_code == 409


def test_put_jogo_finalizado_retorna_409(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        jogo = finalizar_jogo(db, jogo, 1, 0)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.put(
        f"/jogos/{jid}",
        headers=h,
        json={"data_jogo": (datetime.now(UTC) + timedelta(days=5)).isoformat()},
    )
    assert r.status_code == 409


def test_put_resultado_especial_desfinalizar_retorna_400_antes_de_finalizar(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.post(
        "/resultados-especiais",
        headers=h,
        json={
            "campeao_id": None,
            "vice_campeao_id": None,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
            "finalizado": False,
        },
    ).status_code == 201
    r = client.put(
        "/resultados-especiais",
        headers=h,
        json={
            "campeao_id": None,
            "vice_campeao_id": None,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
            "finalizado": False,
        },
    )
    assert r.status_code == 400


def test_put_resultado_especial_finalizado_retorna_409(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.post(
        "/resultados-especiais",
        headers=h,
        json={
            "campeao_id": None,
            "vice_campeao_id": None,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
            "finalizado": False,
        },
    ).status_code == 201
    assert client.patch("/resultados-especiais/finalizar", headers=h).status_code == 200
    r = client.put(
        "/resultados-especiais",
        headers=h,
        json={
            "campeao_id": None,
            "vice_campeao_id": None,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": None,
            "finalizado": False,
        },
    )
    assert r.status_code == 409


def test_put_pontuacao_fase_congelada_apos_jogo_finalizado(client) -> None:
    db = SessionLocal()
    try:
        _, admin_id, user_id = seed_owner_admin_e_usuario(db)
        from app.models.usuario import Usuario

        admin = db.get(Usuario, admin_id)
        assert admin is not None
        empresa_id = admin.empresa_id
        assert empresa_id is not None
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        from app.models.palpite_jogo import PalpiteJogo

        db.add(
            PalpiteJogo(
                usuario_id=user_id,
                jogo_id=jogo.id,
                palpite_casa=1,
                palpite_fora=0,
            )
        )
        db.commit()
        finalizar_jogo(db, jogo, 1, 0)
        from app.services import pontuacao_fase_service

        fases = pontuacao_fase_service.ensure_defaults_empresa(db, empresa_id)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    payload = {
        "itens": [
            {
                "fase_key": f.fase_key,
                "label": f.label,
                "ordem": f.ordem,
                "pontos_placar_exato": f.pontos_placar_exato + 1,
                "pontos_resultado_correto": f.pontos_resultado_correto,
                "pontos_classificado_mata_mata": f.pontos_classificado_mata_mata,
            }
            for f in fases
        ]
    }
    r = client.put("/configuracao-pontuacao-fase", headers=h, json=payload)
    assert r.status_code == 409


def test_put_configuracao_bolao_congelada_apos_jogo_finalizado(client) -> None:
    db = SessionLocal()
    try:
        _, admin_id, user_id = seed_owner_admin_e_usuario(db)
        from app.models.usuario import Usuario

        admin = db.get(Usuario, admin_id)
        assert admin is not None
        empresa_id = admin.empresa_id
        assert empresa_id is not None
        a, b = seed_dois_paises(db)
        jogo = seed_jogo_grupo_em_breve(db, a, b)
        from app.models.palpite_jogo import PalpiteJogo

        db.add(
            PalpiteJogo(
                usuario_id=user_id,
                jogo_id=jogo.id,
                palpite_casa=1,
                palpite_fora=0,
            )
        )
        db.commit()
        finalizar_jogo(db, jogo, 1, 0)
        from app.services import configuracao_bolao_service

        cfg = configuracao_bolao_service.ensure_configuracao_empresa(db, empresa_id)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}
    payload = ConfiguracaoBolaoWrite(
        data_bloqueio_palpites_especiais=cfg.data_bloqueio_palpites_especiais,
        pontos_campeao=cfg.pontos_campeao + 1,
        pontos_vice_campeao=cfg.pontos_vice_campeao,
        pontos_terceiro_lugar=cfg.pontos_terceiro_lugar,
        pontos_artilheiro_pais=cfg.pontos_artilheiro_pais,
        pontos_placar_exato=cfg.pontos_placar_exato,
        pontos_resultado_correto=cfg.pontos_resultado_correto,
        pontos_classificado_mata_mata=cfg.pontos_classificado_mata_mata,
        pontos_marcador_brasil=cfg.pontos_marcador_brasil,
        pontos_marcador_brasil_com_quantidade=cfg.pontos_marcador_brasil_com_quantidade,
    )
    r = client.put("/configuracao-bolao", headers=h, json=payload.model_dump(mode="json"))
    assert r.status_code == 409


def test_login_usuario_bloqueado_retorna_401_generico(client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
        from app.models.usuario import Usuario

        user = db.get(Usuario, user_id)
        assert user is not None
        user.bloqueado = True
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r.status_code == 401
    assert r.json()["detail"] == "E-mail ou senha incorretos"


def test_refresh_usuario_bloqueado_sem_revogar_retorna_403(client) -> None:
    db = SessionLocal()
    try:
        _, _, user_id = seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200, r_login.text
    refresh_cookie = r_login.cookies.get("bolao_refresh_token")
    assert refresh_cookie

    db = SessionLocal()
    try:
        from app.models.usuario import Usuario

        user = db.get(Usuario, user_id)
        assert user is not None
        user.bloqueado = True
        db.commit()
    finally:
        db.close()

    client.cookies.set("bolao_refresh_token", refresh_cookie, path="/auth")
    assert client.post("/auth/refresh").status_code == 403


def test_refresh_apos_bloquear_via_equipe_retorna_401(client) -> None:
    db = SessionLocal()
    try:
        _, admin_id, user_id = seed_owner_admin_e_usuario(db)
        from app.models.usuario import Usuario

        user = db.get(Usuario, user_id)
        admin = db.get(Usuario, admin_id)
        assert user is not None and admin is not None
    finally:
        db.close()

    r_login = client.post("/auth/login", json={"email": "user-etapa13@example.com", "senha": "senhausuario1"})
    assert r_login.status_code == 200, r_login.text

    token_admin = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    assert (
        client.patch(
            f"/equipe/{user_id}/bloquear",
            headers={"Authorization": f"Bearer {token_admin}"},
            params={"bloqueado": True},
        ).status_code
        == 200
    )

    client.cookies.set("bolao_refresh_token", r_login.cookies.get("bolao_refresh_token"), path="/auth")
    assert client.post(
        "/auth/refresh",
        headers={"X-Bolao-Client": "1", "Origin": "http://localhost:5173"},
    ).status_code == 401


def test_marcadores_oficiais_soma_invalida_retorna_400(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
        br, fora = seed_brasil_e_adversario(db)
        jogo = seed_jogo_brasil_em_breve(db, br, fora)
        jid = jogo.id
    finally:
        db.close()

    token = _login(client, "owner-etapa13@example.com", "senhaowner1")
    h = {"Authorization": f"Bearer {token}"}
    assert (
        client.patch(
            f"/jogos/{jid}/resultado",
            headers=h,
            json={"placar_casa": 2, "placar_fora": 0},
        ).status_code
        == 200
    )
    r = client.post(
        f"/marcadores-brasil/resultado/{jid}",
        headers=h,
        json={
            "marcadores": [
                {"nome_jogador": "Jogador A", "quantidade_gols": 2},
                {"nome_jogador": "Jogador B", "quantidade_gols": 1},
            ]
        },
    )
    assert r.status_code == 400


def test_marcadores_get_e_post_desabilitados_retornam_403(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        br, fora = seed_brasil_e_adversario(db)
        jogo = seed_jogo_brasil_em_breve(db, br, fora)
        jid = jogo.id
        from app.models.empresa import Empresa
        from app.models.usuario import Usuario

        user = db.query(Usuario).filter(Usuario.email == "user-etapa13@example.com").one()
        empresa = db.get(Empresa, user.empresa_id)
        assert empresa is not None
        empresa.marcadores_brasil_habilitado = False
        db.commit()
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    assert client.get(f"/marcadores-brasil/me/{jid}", headers=h).status_code == 403
    r_post = client.post(
        f"/marcadores-brasil/{jid}",
        headers=h,
        json={"marcadores": [{"nome_jogador": "Jogador A", "quantidade_gols": 1}]},
    )
    assert r_post.status_code == 403
