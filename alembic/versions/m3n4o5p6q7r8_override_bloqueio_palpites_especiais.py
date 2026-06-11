"""override_bloqueio_palpites_especiais

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-06-11

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m3n4o5p6q7r8"
down_revision: Union[str, Sequence[str], None] = "l2m3n4o5p6q7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "configuracoes_bolao",
        sa.Column("override_bloqueio_palpites_especiais", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("configuracoes_bolao", "override_bloqueio_palpites_especiais")
