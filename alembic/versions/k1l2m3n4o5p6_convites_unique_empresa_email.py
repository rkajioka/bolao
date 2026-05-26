"""convites_unique_empresa_email

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-26

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, Sequence[str], None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove duplicate pending invites (keep the most recent per empresa+email pair)
    op.execute(
        """
        DELETE FROM convites
        WHERE id NOT IN (
            SELECT DISTINCT ON (empresa_id, email) id
            FROM convites
            ORDER BY empresa_id, email, created_at DESC
        )
        """
    )
    op.create_unique_constraint(
        "uq_convites_empresa_email",
        "convites",
        ["empresa_id", "email"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_convites_empresa_email", "convites", type_="unique")
