"""jogos_rodada

Revision ID: c4e5f6a7b8d9
Revises: a1c2b3d4e5f6
Create Date: 2026-05-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4e5f6a7b8d9"
down_revision: Union[str, Sequence[str], None] = "a1c2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jogos", sa.Column("rodada", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("jogos", "rodada")
