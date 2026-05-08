"""pontuacao_fase_e_especiais_v2

Revision ID: e8f9012a3b4c
Revises: d7e8f9a0b1c2
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e8f9012a3b4c"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("configuracoes_bolao", sa.Column("pontos_vice_campeao", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("configuracoes_bolao", sa.Column("pontos_terceiro_lugar", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("configuracoes_bolao", sa.Column("pontos_artilheiro_pais", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("palpites_especiais", sa.Column("pontuacao_vice_campeao", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("palpites_especiais", sa.Column("pontuacao_terceiro_lugar", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("palpites_especiais", sa.Column("pontuacao_artilheiro_pais", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("resultados_especiais", sa.Column("vice_campeao_id", sa.Integer(), nullable=True))
    op.add_column("resultados_especiais", sa.Column("terceiro_lugar_id", sa.Integer(), nullable=True))
    op.add_column("resultados_especiais", sa.Column("artilheiro_pais_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_resultados_especiais_vice_campeao_id_paises", "resultados_especiais", "paises", ["vice_campeao_id"], ["id"])
    op.create_foreign_key("fk_resultados_especiais_terceiro_lugar_id_paises", "resultados_especiais", "paises", ["terceiro_lugar_id"], ["id"])
    op.create_foreign_key("fk_resultados_especiais_artilheiro_pais_id_paises", "resultados_especiais", "paises", ["artilheiro_pais_id"], ["id"])

    op.create_table(
        "pontuacao_fase",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fase_key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pontos_placar_exato", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pontos_resultado_correto", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pontos_classificado_mata_mata", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("fase_key", name="uq_pontuacao_fase_key"),
    )

    op.execute(
        """
        INSERT INTO pontuacao_fase (fase_key, label, ordem, pontos_placar_exato, pontos_resultado_correto, pontos_classificado_mata_mata)
        VALUES
          ('grupo_rodada_1', 'Grupos - Rodada 1', 10, 10, 5, 0),
          ('grupo_rodada_2', 'Grupos - Rodada 2', 20, 10, 5, 0),
          ('grupo_rodada_3', 'Grupos - Rodada 3', 30, 10, 5, 0),
          ('dezesseis_avos', '32-avos', 40, 12, 6, 6),
          ('oitavas', '16-avos', 50, 14, 7, 7),
          ('quartas', 'Quartas', 60, 16, 8, 8),
          ('semi', 'Semifinal', 70, 18, 9, 9),
          ('terceiro_lugar', 'Disputa 3º', 80, 20, 10, 10),
          ('final', 'Final', 90, 24, 12, 12)
        """
    )


def downgrade() -> None:
    op.drop_table("pontuacao_fase")

    op.drop_constraint("fk_resultados_especiais_artilheiro_pais_id_paises", "resultados_especiais", type_="foreignkey")
    op.drop_constraint("fk_resultados_especiais_terceiro_lugar_id_paises", "resultados_especiais", type_="foreignkey")
    op.drop_constraint("fk_resultados_especiais_vice_campeao_id_paises", "resultados_especiais", type_="foreignkey")
    op.drop_column("resultados_especiais", "artilheiro_pais_id")
    op.drop_column("resultados_especiais", "terceiro_lugar_id")
    op.drop_column("resultados_especiais", "vice_campeao_id")

    op.drop_column("palpites_especiais", "pontuacao_artilheiro_pais")
    op.drop_column("palpites_especiais", "pontuacao_terceiro_lugar")
    op.drop_column("palpites_especiais", "pontuacao_vice_campeao")

    op.drop_column("configuracoes_bolao", "pontos_artilheiro_pais")
    op.drop_column("configuracoes_bolao", "pontos_terceiro_lugar")
    op.drop_column("configuracoes_bolao", "pontos_vice_campeao")
