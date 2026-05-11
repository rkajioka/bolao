import re

SENHA_COMPLEXIDADE_MSG = (
    "A senha deve ter ao menos 8 caracteres, 1 letra maiúscula e 1 caractere especial"
)


def validar_complexidade_senha(senha: str) -> None:
    if len(senha) < 8:
        raise ValueError(SENHA_COMPLEXIDADE_MSG)
    if not re.search(r"[A-Z]", senha):
        raise ValueError(SENHA_COMPLEXIDADE_MSG)
    if not re.search(r"[^A-Za-z0-9]", senha):
        raise ValueError(SENHA_COMPLEXIDADE_MSG)
