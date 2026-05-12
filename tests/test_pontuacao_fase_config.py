"""Configuração de pontuação por fase (tenant)."""

from __future__ import annotations

from app.database import SessionLocal
from app.schemas.usuario import UsuarioCreate
from app.services import pontuacao_fase_service, usuario_service
from app.services.pontuacao_fase_service import DEFAULTS
from tests.factories import seed_empresa, seed_owner_admin_e_usuario


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _fases_payload(rows: list[dict]) -> dict:
    return {
        "itens": [
            {
                "fase_key": row["fase_key"],
                "label": row["label"],
                "ordem": row["ordem"],
                "pontos_placar_exato": row["pontos_placar_exato"],
                "pontos_resultado_correto": row["pontos_resultado_correto"],
                "pontos_classificado_mata_mata": row["pontos_classificado_mata_mata"],
            }
            for row in rows
        ]
    }


def test_defaults_mata_mata_labels_alinhados() -> None:
    labels = {
        str(row["fase_key"]): str(row["label"])
        for row in DEFAULTS
        if str(row["fase_key"])
        in {
            "dezesseis_avos",
            "oitavas",
            "quartas",
            "semi",
            "terceiro_lugar",
            "final",
        }
    }
    assert labels == {
        "dezesseis_avos": "16-avos",
        "oitavas": "Oitavas",
        "quartas": "Quartas",
        "semi": "Semifinal",
        "terceiro_lugar": "3º lugar",
        "final": "Final",
    }


def test_admin_lista_nove_fases_padrao(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}

    r = client.get("/configuracao-pontuacao-fase", headers=h)
    assert r.status_code == 200
    fases = r.json()
    assert len(fases) == 9
    keys = {f["fase_key"] for f in fases}
    assert "grupo_rodada_1" in keys
    assert "final" in keys


def test_admin_atualiza_pontuacao_por_fase(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}

    r_get = client.get("/configuracao-pontuacao-fase", headers=h)
    assert r_get.status_code == 200
    fases = r_get.json()
    for row in fases:
        if row["fase_key"] == "grupo_rodada_1":
            row["pontos_placar_exato"] = 42
            break

    r_put = client.put("/configuracao-pontuacao-fase", headers=h, json=_fases_payload(fases))
    assert r_put.status_code == 200
    atualizada = next(x for x in r_put.json() if x["fase_key"] == "grupo_rodada_1")
    assert atualizada["pontos_placar_exato"] == 42

    r_check = client.get("/configuracao-pontuacao-fase", headers=h)
    assert r_check.status_code == 200
    persistida = next(x for x in r_check.json() if x["fase_key"] == "grupo_rodada_1")
    assert persistida["pontos_placar_exato"] == 42


def test_admin_rejeita_payload_incompleto(client) -> None:
    db = SessionLocal()
    try:
        seed_owner_admin_e_usuario(db)
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}

    r = client.put(
        "/configuracao-pontuacao-fase",
        headers=h,
        json={
            "itens": [
                {
                    "fase_key": "grupo_rodada_1",
                    "label": "Grupos - Rodada 1",
                    "ordem": 10,
                    "pontos_placar_exato": 10,
                    "pontos_resultado_correto": 5,
                    "pontos_classificado_mata_mata": 0,
                }
            ]
        },
    )
    assert r.status_code == 400


def test_admin_nao_acessa_fases_de_outra_empresa(client) -> None:
    db = SessionLocal()
    outra_id: int
    try:
        seed_owner_admin_e_usuario(db)
        outra = seed_empresa(db, "OUTRA")
        outra_id = outra.id
    finally:
        db.close()

    token = _login(client, "admin-etapa13@example.com", "senhaadmin1")
    h = {"Authorization": f"Bearer {token}"}

    r = client.get(f"/configuracao-pontuacao-fase?empresa_id={outra_id}", headers=h)
    assert r.status_code == 403


def test_fases_minha_isoladas_por_empresa(client) -> None:
    db = SessionLocal()
    try:
        emp_a = seed_empresa(db, "EMP-A")
        emp_b = seed_empresa(db, "EMP-B")

        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Admin A",
                email="admin-a@example.com",
                senha_plana="senhaadmin1",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp_a.id,
            ),
        )
        usuario_service.create_usuario(
            db,
            UsuarioCreate(
                nome="Admin B",
                email="admin-b@example.com",
                senha_plana="senhaadmin1",
                tipo_usuario="admin",
                ativo=True,
                primeiro_login=False,
                empresa_id=emp_b.id,
            ),
        )

        fases_a = pontuacao_fase_service.listar_empresa(db, emp_a.id)
        fases_b = pontuacao_fase_service.listar_empresa(db, emp_b.id)
        for row in fases_a:
            if row.fase_key == "semi":
                row.pontos_placar_exato = 77
        for row in fases_b:
            if row.fase_key == "semi":
                row.pontos_placar_exato = 11
        db.commit()
    finally:
        db.close()

    token_a = _login(client, "admin-a@example.com", "senhaadmin1")
    token_b = _login(client, "admin-b@example.com", "senhaadmin1")

    r_a = client.get("/configuracao-pontuacao-fase/minha", headers={"Authorization": f"Bearer {token_a}"})
    r_b = client.get("/configuracao-pontuacao-fase/minha", headers={"Authorization": f"Bearer {token_b}"})
    assert r_a.status_code == 200
    assert r_b.status_code == 200

    semi_a = next(x for x in r_a.json() if x["fase_key"] == "semi")
    semi_b = next(x for x in r_b.json() if x["fase_key"] == "semi")
    assert semi_a["pontos_placar_exato"] == 77
    assert semi_b["pontos_placar_exato"] == 11
