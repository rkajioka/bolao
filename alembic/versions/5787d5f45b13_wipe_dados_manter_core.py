"""wipe_dados_manter_core

Esvazia dados operacionais do bolão preservando paises, usuarios e empresas.
Destinado a PostgreSQL. Irreversível sem backup.

Revision ID: 5787d5f45b13
Revises: a9b1c2d3e4f5
Create Date: 2026-05-08 15:20:59.886053

"""
from typing import Sequence, Union

from alembic import op

revision: str = "5787d5f45b13"
down_revision: Union[str, Sequence[str], None] = "a9b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        TRUNCATE TABLE
            audit_logs,
            auditoria_admin,
            candidatos_marcador_brasil,
            configuracoes_bolao,
            convites,
            jogos,
            marcadores_brasil_palpite,
            marcadores_brasil_resultado,
            palpites_especiais,
            palpites_jogos,
            password_resets,
            pontuacao_fase,
            refresh_tokens,
            resultados_especiais
        RESTART IDENTITY CASCADE;
        """
    )


def downgrade() -> None:
    """Dados truncados não podem ser restaurados por downgrade."""
