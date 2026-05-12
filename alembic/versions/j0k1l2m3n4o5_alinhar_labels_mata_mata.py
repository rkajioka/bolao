"""alinhar_labels_mata_mata

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-05-11

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "j0k1l2m3n4o5"
down_revision: Union[str, Sequence[str], None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LABELS_MATA_MATA: tuple[tuple[str, str], ...] = (
    ("dezesseis_avos", "16-avos"),
    ("oitavas", "Oitavas"),
    ("quartas", "Quartas"),
    ("semi", "Semifinal"),
    ("terceiro_lugar", "3º lugar"),
    ("final", "Final"),
)


def upgrade() -> None:
    for fase_key, label in _LABELS_MATA_MATA:
        op.execute(
            f"UPDATE pontuacao_fase SET label = '{label}' WHERE fase_key = '{fase_key}'"
        )


def downgrade() -> None:
    legacy: tuple[tuple[str, str], ...] = (
        ("dezesseis_avos", "32-avos"),
        ("oitavas", "16-avos"),
        ("quartas", "Quartas"),
        ("semi", "Semifinal"),
        ("terceiro_lugar", "Disputa 3º"),
        ("final", "Final"),
    )
    for fase_key, label in legacy:
        op.execute(
            f"UPDATE pontuacao_fase SET label = '{label}' WHERE fase_key = '{fase_key}'"
        )
