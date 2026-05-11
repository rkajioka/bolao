"""empresa_marcadores_brasil_flag

Revision ID: h8i9j0k1l2m3
Revises: g1h2i3j4k5l6
Create Date: 2026-05-11

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = "g1h2i3j4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "empresas",
        sa.Column(
            "marcadores_brasil_habilitado",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute(sa.text("UPDATE empresas SET marcadores_brasil_habilitado = TRUE"))


def downgrade() -> None:
    op.drop_column("empresas", "marcadores_brasil_habilitado")
