"""p0_security_indexes_convite_unique

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-25

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, Sequence[str], None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_convite_empresa_email",
        "convites",
        ["empresa_id", "email"],
    )
    op.create_index("ix_usuarios_tipo_usuario", "usuarios", ["tipo_usuario"])
    op.create_index(
        "ix_audit_logs_empresa_created",
        "audit_logs",
        ["empresa_id", "created_at"],
    )
    op.create_index("ix_password_resets_expiracao", "password_resets", ["expiracao"])
    op.create_index("ix_convites_expiracao", "convites", ["expiracao"])


def downgrade() -> None:
    op.drop_index("ix_convites_expiracao", table_name="convites")
    op.drop_index("ix_password_resets_expiracao", table_name="password_resets")
    op.drop_index("ix_audit_logs_empresa_created", table_name="audit_logs")
    op.drop_index("ix_usuarios_tipo_usuario", table_name="usuarios")
    op.drop_constraint("uq_convite_empresa_email", "convites", type_="unique")
