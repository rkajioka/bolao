"""roles_tenant_tema

Revision ID: g1h2i3j4k5l6
Revises: f9e8d7c6b5a4
Create Date: 2026-05-11

"""

from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, Sequence[str], None] = "f9e8d7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_THEME_DARK = {
    "bg": "#070A12",
    "bg-2": "#0B1020",
    "glass": "rgba(255, 255, 255, 0.06)",
    "glass-hover": "rgba(255, 255, 255, 0.10)",
    "border": "rgba(255, 255, 255, 0.10)",
    "border-hover": "rgba(255, 255, 255, 0.18)",
    "text": "#F8FAFC",
    "text-muted": "#A7B0C0",
    "accent": "#35D07F",
    "accent-dim": "rgba(53, 208, 127, 0.15)",
    "highlight": "#D4A017",
    "highlight-dim": "rgba(212, 160, 23, 0.15)",
    "danger": "#FF5C7A",
    "danger-dim": "rgba(255, 92, 122, 0.15)",
    "topbar-bg": "rgba(7, 10, 18, 0.85)",
    "nav-bg": "rgba(7, 10, 18, 0.90)",
    "segmented-bg": "rgba(255, 255, 255, 0.04)",
    "segmented-border": "rgba(255, 255, 255, 0.08)",
    "segmented-active-bg": "rgba(255, 255, 255, 0.12)",
    "segmented-active-border": "rgba(255, 255, 255, 0.14)",
    "theme-color": "#070A12",
}

DEFAULT_THEME_LIGHT = {
    "bg": "#F0F2F7",
    "bg-2": "#E4E8F0",
    "glass": "rgba(255, 255, 255, 0.70)",
    "glass-hover": "rgba(255, 255, 255, 0.88)",
    "border": "rgba(0, 0, 0, 0.08)",
    "border-hover": "rgba(0, 0, 0, 0.15)",
    "text": "#0F1117",
    "text-muted": "#5A6478",
    "accent": "#1DB864",
    "accent-dim": "rgba(29, 184, 100, 0.12)",
    "highlight": "#B8860B",
    "highlight-dim": "rgba(184, 134, 11, 0.12)",
    "danger": "#E03050",
    "danger-dim": "rgba(224, 48, 80, 0.10)",
    "topbar-bg": "rgba(240, 242, 247, 0.88)",
    "nav-bg": "rgba(240, 242, 247, 0.92)",
    "segmented-bg": "rgba(0, 0, 0, 0.05)",
    "segmented-border": "rgba(0, 0, 0, 0.09)",
    "segmented-active-bg": "rgba(255, 255, 255, 0.92)",
    "segmented-active-border": "rgba(0, 0, 0, 0.10)",
    "theme-color": "#F0F2F7",
}


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "plataforma_temas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tokens_dark", sa.JSON(), nullable=False),
        sa.Column("tokens_light", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    bind.execute(
        sa.text(
            "INSERT INTO plataforma_temas (tokens_dark, tokens_light) VALUES (:dark, :light)"
        ),
        {"dark": json.dumps(DEFAULT_THEME_DARK), "light": json.dumps(DEFAULT_THEME_LIGHT)},
    )

    op.create_table(
        "empresa_temas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tokens_dark", sa.JSON(), nullable=False),
        sa.Column("tokens_light", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.UniqueConstraint("empresa_id", name="uq_empresa_temas_empresa_id"),
    )

    op.add_column("configuracoes_bolao", sa.Column("empresa_id", sa.Integer(), nullable=True))
    op.add_column("pontuacao_fase", sa.Column("empresa_id", sa.Integer(), nullable=True))

    empresas = bind.execute(sa.text("SELECT id FROM empresas ORDER BY id")).fetchall()
    if not empresas:
        default_empresa = bind.execute(
            sa.text(
                "INSERT INTO empresas (nome, codigo_empresa, ativo) "
                "VALUES ('Empresa padrão', 'DEFAULT', 1) RETURNING id"
            )
        ).fetchone()
        empresas = [default_empresa]

    global_cfg = bind.execute(
        sa.text("SELECT * FROM configuracoes_bolao ORDER BY id ASC LIMIT 1")
    ).mappings().first()
    global_fases = bind.execute(
        sa.text("SELECT * FROM pontuacao_fase ORDER BY ordem ASC, id ASC")
    ).mappings().all()

    for row in empresas:
        empresa_id = row[0]
        if global_cfg is not None:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO configuracoes_bolao (
                        empresa_id,
                        data_bloqueio_palpites_especiais,
                        pontos_campeao, pontos_vice_campeao, pontos_terceiro_lugar, pontos_artilheiro_pais,
                        pontos_placar_exato, pontos_resultado_correto, pontos_classificado_mata_mata,
                        pontos_marcador_brasil, pontos_marcador_brasil_com_quantidade
                    ) VALUES (
                        :empresa_id,
                        :data_bloqueio_palpites_especiais,
                        :pontos_campeao, :pontos_vice_campeao, :pontos_terceiro_lugar, :pontos_artilheiro_pais,
                        :pontos_placar_exato, :pontos_resultado_correto, :pontos_classificado_mata_mata,
                        :pontos_marcador_brasil, :pontos_marcador_brasil_com_quantidade
                    )
                    """
                ),
                {"empresa_id": empresa_id, **{k: global_cfg[k] for k in global_cfg.keys() if k not in {"id", "created_at", "updated_at"}}},
            )
        else:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO configuracoes_bolao (
                        empresa_id,
                        pontos_campeao, pontos_vice_campeao, pontos_terceiro_lugar, pontos_artilheiro_pais,
                        pontos_placar_exato, pontos_resultado_correto, pontos_classificado_mata_mata,
                        pontos_marcador_brasil, pontos_marcador_brasil_com_quantidade
                    ) VALUES (
                        :empresa_id, 35, 25, 20, 20, 18, 10, 12, 4, 4
                    )
                    """
                ),
                {"empresa_id": empresa_id},
            )

        for fase in global_fases:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO pontuacao_fase (
                        empresa_id, fase_key, label, ordem,
                        pontos_placar_exato, pontos_resultado_correto, pontos_classificado_mata_mata
                    ) VALUES (
                        :empresa_id, :fase_key, :label, :ordem,
                        :pontos_placar_exato, :pontos_resultado_correto, :pontos_classificado_mata_mata
                    )
                    """
                ),
                {
                    "empresa_id": empresa_id,
                    "fase_key": fase["fase_key"],
                    "label": fase["label"],
                    "ordem": fase["ordem"],
                    "pontos_placar_exato": fase["pontos_placar_exato"],
                    "pontos_resultado_correto": fase["pontos_resultado_correto"],
                    "pontos_classificado_mata_mata": fase["pontos_classificado_mata_mata"],
                },
            )

        bind.execute(
            sa.text(
                "INSERT INTO empresa_temas (empresa_id, tokens_dark, tokens_light) VALUES (:empresa_id, :dark, :light)"
            ),
            {
                "empresa_id": empresa_id,
                "dark": json.dumps(DEFAULT_THEME_DARK),
                "light": json.dumps(DEFAULT_THEME_LIGHT),
            },
        )

    if global_cfg is not None:
        bind.execute(sa.text("DELETE FROM configuracoes_bolao WHERE empresa_id IS NULL"))
    bind.execute(sa.text("DELETE FROM pontuacao_fase WHERE empresa_id IS NULL"))

    op.alter_column("configuracoes_bolao", "empresa_id", nullable=False)
    op.alter_column("pontuacao_fase", "empresa_id", nullable=False)
    op.create_foreign_key(
        "fk_configuracoes_bolao_empresa_id",
        "configuracoes_bolao",
        "empresas",
        ["empresa_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_pontuacao_fase_empresa_id",
        "pontuacao_fase",
        "empresas",
        ["empresa_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_configuracoes_bolao_empresa_id", "configuracoes_bolao", ["empresa_id"])
    op.drop_constraint("uq_pontuacao_fase_key", "pontuacao_fase", type_="unique")
    op.create_unique_constraint(
        "uq_pontuacao_fase_empresa_fase", "pontuacao_fase", ["empresa_id", "fase_key"]
    )

    bind.execute(
        sa.text(
            "UPDATE usuarios SET tipo_usuario = 'owner' "
            "WHERE id = (SELECT MIN(id) FROM usuarios WHERE tipo_usuario = 'admin')"
        )
    )


def downgrade() -> None:
    op.drop_constraint("uq_pontuacao_fase_empresa_fase", "pontuacao_fase", type_="unique")
    op.create_unique_constraint("uq_pontuacao_fase_key", "pontuacao_fase", ["fase_key"])
    op.drop_constraint("uq_configuracoes_bolao_empresa_id", "configuracoes_bolao", type_="unique")
    op.drop_constraint("fk_pontuacao_fase_empresa_id", "pontuacao_fase", type_="foreignkey")
    op.drop_constraint("fk_configuracoes_bolao_empresa_id", "configuracoes_bolao", type_="foreignkey")
    op.drop_column("pontuacao_fase", "empresa_id")
    op.drop_column("configuracoes_bolao", "empresa_id")
    op.drop_table("empresa_temas")
    op.drop_table("plataforma_temas")
