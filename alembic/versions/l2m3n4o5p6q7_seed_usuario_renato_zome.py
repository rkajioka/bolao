"""seed_usuario_renato_zome

Cria usuário Renato Zome (empresa_id=2) se o e-mail ainda não existir.

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-06-01

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
import bcrypt
from alembic import op

revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, Sequence[str], None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EMAIL = "renatozome@lpclatina.com.br"
_NOME = "Renato Zome"
_FUNCAO = "TI"
_TIPO_USUARIO = "usuario"
_EMPRESA_ID = 2
_SENHA = "Bolao123!"
_BCRYPT_ROUNDS = 12


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("ascii")


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text("SELECT 1 FROM usuarios WHERE email = :email"),
        {"email": _EMAIL},
    ).scalar()
    if exists:
        return

    bind.execute(
        sa.text(
            """
            INSERT INTO usuarios (
                nome,
                email,
                senha_hash,
                funcao,
                tipo_usuario,
                empresa_id,
                ativo,
                bloqueado,
                primeiro_login
            ) VALUES (
                :nome,
                :email,
                :senha_hash,
                :funcao,
                :tipo_usuario,
                :empresa_id,
                TRUE,
                FALSE,
                FALSE
            )
            """
        ),
        {
            "nome": _NOME,
            "email": _EMAIL,
            "senha_hash": _hash_password(_SENHA),
            "funcao": _FUNCAO,
            "tipo_usuario": _TIPO_USUARIO,
            "empresa_id": _EMPRESA_ID,
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM usuarios WHERE email = :email"),
        {"email": _EMAIL},
    )
