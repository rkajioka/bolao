"""remove_campos_legados_especiais

Revision ID: f1a2b3c4d5e6
Revises: e8f9012a3b4c
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e8f9012a3b4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("palpites_especiais", "melhor_jogador")
    op.drop_column("palpites_especiais", "artilheiro")
    op.drop_column("palpites_especiais", "melhor_goleiro")
    op.drop_column("palpites_especiais", "pontuacao_melhor_jogador")
    op.drop_column("palpites_especiais", "pontuacao_artilheiro")
    op.drop_column("palpites_especiais", "pontuacao_melhor_goleiro")

    op.drop_column("resultados_especiais", "melhor_jogador")
    op.drop_column("resultados_especiais", "artilheiro")
    op.drop_column("resultados_especiais", "melhor_goleiro")

    op.drop_column("configuracoes_bolao", "pontos_melhor_jogador")
    op.drop_column("configuracoes_bolao", "pontos_artilheiro")
    op.drop_column("configuracoes_bolao", "pontos_melhor_goleiro")


def downgrade() -> None:
    op.add_column(
        "configuracoes_bolao",
        sa.Column("pontos_melhor_goleiro", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "configuracoes_bolao",
        sa.Column("pontos_artilheiro", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "configuracoes_bolao",
        sa.Column("pontos_melhor_jogador", sa.Integer(), nullable=False, server_default="0"),
    )

    op.add_column(
        "resultados_especiais",
        sa.Column("melhor_goleiro", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "resultados_especiais",
        sa.Column("artilheiro", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "resultados_especiais",
        sa.Column("melhor_jogador", sa.String(length=255), nullable=True),
    )

    op.add_column(
        "palpites_especiais",
        sa.Column("pontuacao_melhor_goleiro", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "palpites_especiais",
        sa.Column("pontuacao_artilheiro", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "palpites_especiais",
        sa.Column("pontuacao_melhor_jogador", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "palpites_especiais",
        sa.Column("melhor_goleiro", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "palpites_especiais",
        sa.Column("artilheiro", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "palpites_especiais",
        sa.Column("melhor_jogador", sa.String(length=255), nullable=True),
    )
