"""auditoria_admin

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auditoria_admin",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("admin_user_id", sa.Integer(), nullable=False),
        sa.Column("acao", sa.String(length=128), nullable=False),
        sa.Column("entidade", sa.String(length=64), nullable=False),
        sa.Column("entidade_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="success"),
        sa.Column("detalhes_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["admin_user_id"], ["usuarios.id"]),
    )
    op.create_index("ix_auditoria_admin_admin_user_id", "auditoria_admin", ["admin_user_id"], unique=False)
    op.create_index("ix_auditoria_admin_created_at", "auditoria_admin", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_auditoria_admin_created_at", table_name="auditoria_admin")
    op.drop_index("ix_auditoria_admin_admin_user_id", table_name="auditoria_admin")
    op.drop_table("auditoria_admin")
