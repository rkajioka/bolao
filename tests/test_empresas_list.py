from __future__ import annotations

def test_empresas_list_requer_autenticacao(client) -> None:
    response = client.get("/empresas/")
    assert response.status_code == 401
