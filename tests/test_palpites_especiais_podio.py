"""Palpites especiais — países distintos no pódio."""

from __future__ import annotations

from app.database import SessionLocal
from tests.factories import seed_admin_e_usuario, seed_dois_paises


def _login(client, email: str, senha: str) -> str:
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_post_palpite_especial_rejeita_pais_repetido_no_podio(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={
            "campeao_id": a,
            "vice_campeao_id": a,
            "terceiro_lugar_id": b,
            "artilheiro_pais_id": a,
        },
    )
    assert r.status_code in (400, 422)
    detail = r.json()["detail"]
    if isinstance(detail, list):
        texto = " ".join(str(item.get("msg", item)) for item in detail)
    else:
        texto = str(detail)
    assert "distintos" in texto.lower()


def test_post_palpite_especial_permite_repetir_podio_com_artilheiro(client) -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
    finally:
        db.close()

    token = _login(client, "user-etapa13@example.com", "senhausuario1")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/palpites-especiais",
        headers=h,
        json={
            "campeao_id": a,
            "vice_campeao_id": b,
            "terceiro_lugar_id": None,
            "artilheiro_pais_id": a,
        },
    )
    assert r.status_code == 201, r.text
