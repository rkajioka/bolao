from __future__ import annotations

def test_ativar_conta_token_invalido(client) -> None:
    response = client.post(
        "/auth/ativar-conta",
        json={
            "token": "token-invalido",
            "senha": "SenhaSegura1!",
            "confirmar_senha": "SenhaSegura1!",
            "nome": "Novo Usuário",
        },
    )
    assert response.status_code in {400, 404, 422}
