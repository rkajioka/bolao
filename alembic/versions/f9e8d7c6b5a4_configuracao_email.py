"""configuracao_email resend

Revision ID: f9e8d7c6b5a4
Revises: 5787d5f45b13
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f9e8d7c6b5a4"
down_revision: Union[str, Sequence[str], None] = "5787d5f45b13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "configuracao_email",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("resend_api_key", sa.Text(), nullable=True),
        sa.Column("email_from", sa.String(length=320), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO configuracao_email (id, resend_api_key, email_from) "
            "VALUES (1, NULL, 'onboarding@resend.dev')"
        )
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "SELECT setval(pg_get_serial_sequence('configuracao_email', 'id'), "
                "(SELECT COALESCE(MAX(id), 1) FROM configuracao_email))"
            )
        )


def downgrade() -> None:
    op.drop_table("configuracao_email")
