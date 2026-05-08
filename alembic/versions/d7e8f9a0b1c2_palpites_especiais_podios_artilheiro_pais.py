"""palpites_especiais_podios_artilheiro_pais

Revision ID: d7e8f9a0b1c2
Revises: c4e5f6a7b8d9
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c4e5f6a7b8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("palpites_especiais", sa.Column("vice_campeao_id", sa.Integer(), nullable=True))
    op.add_column("palpites_especiais", sa.Column("terceiro_lugar_id", sa.Integer(), nullable=True))
    op.add_column("palpites_especiais", sa.Column("artilheiro_pais_id", sa.Integer(), nullable=True))

    op.create_foreign_key(
        "fk_palpites_especiais_vice_campeao_id_paises",
        "palpites_especiais",
        "paises",
        ["vice_campeao_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_palpites_especiais_terceiro_lugar_id_paises",
        "palpites_especiais",
        "paises",
        ["terceiro_lugar_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_palpites_especiais_artilheiro_pais_id_paises",
        "palpites_especiais",
        "paises",
        ["artilheiro_pais_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_palpites_especiais_artilheiro_pais_id_paises", "palpites_especiais", type_="foreignkey")
    op.drop_constraint("fk_palpites_especiais_terceiro_lugar_id_paises", "palpites_especiais", type_="foreignkey")
    op.drop_constraint("fk_palpites_especiais_vice_campeao_id_paises", "palpites_especiais", type_="foreignkey")

    op.drop_column("palpites_especiais", "artilheiro_pais_id")
    op.drop_column("palpites_especiais", "terceiro_lugar_id")
    op.drop_column("palpites_especiais", "vice_campeao_id")
