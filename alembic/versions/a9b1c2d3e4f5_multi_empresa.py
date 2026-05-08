"""multi_empresa

Revision ID: a9b1c2d3e4f5
Revises: f1a2b3c4d5e6
Create Date: 2026-05-08

Estratégia de migração segura:
1. Cria tabela empresas
2. Insere empresa default "Empresa Padrão" (código: DEFAULT)
3. Adiciona colunas novas em usuarios (nullable primeiro)
4. Vincula todos os usuários existentes à empresa default
5. Cria tabelas convites, password_resets, audit_logs
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Criar tabela empresas
    op.create_table(
        "empresas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("codigo_empresa", sa.String(length=64), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo_empresa"),
    )
    op.create_index("ix_empresas_codigo_empresa", "empresas", ["codigo_empresa"])

    # 2. Inserir empresa default
    op.execute(
        "INSERT INTO empresas (nome, codigo_empresa, ativo) VALUES ('Empresa Padrão', 'DEFAULT', true)"
    )

    # 3. Adicionar novas colunas em usuarios (nullable para não quebrar dados existentes)
    op.add_column(
        "usuarios",
        sa.Column("empresa_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "usuarios",
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "usuarios",
        sa.Column("bloqueado", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "usuarios",
        sa.Column("ultimo_login", sa.DateTime(timezone=True), nullable=True),
    )

    # 4. Vincular usuários existentes à empresa default
    op.execute("UPDATE usuarios SET empresa_id = (SELECT id FROM empresas WHERE codigo_empresa = 'DEFAULT')")

    # 5. Criar FK empresa_id -> empresas
    op.create_foreign_key(
        "fk_usuarios_empresa_id",
        "usuarios",
        "empresas",
        ["empresa_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_usuarios_empresa_id", "usuarios", ["empresa_id"])

    # 6. Criar tabela convites
    op.create_table(
        "convites",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("expiracao", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_por", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["criado_por"], ["usuarios.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_convites_empresa_id", "convites", ["empresa_id"])
    op.create_index("ix_convites_email", "convites", ["email"])
    op.create_index("ix_convites_token", "convites", ["token"])

    # 7. Criar tabela password_resets
    op.create_table(
        "password_resets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("expiracao", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_password_resets_usuario_id", "password_resets", ["usuario_id"])
    op.create_index("ix_password_resets_token", "password_resets", ["token"])

    # 8. Criar tabela audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("empresa_id", sa.Integer(), nullable=True),
        sa.Column("acao", sa.String(length=128), nullable=False),
        sa.Column("alvo", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_usuario_id", "audit_logs", ["usuario_id"])
    op.create_index("ix_audit_logs_empresa_id", "audit_logs", ["empresa_id"])
    op.create_index("ix_audit_logs_acao", "audit_logs", ["acao"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("password_resets")
    op.drop_table("convites")
    op.drop_constraint("fk_usuarios_empresa_id", "usuarios", type_="foreignkey")
    op.drop_index("ix_usuarios_empresa_id", table_name="usuarios")
    op.drop_column("usuarios", "ultimo_login")
    op.drop_column("usuarios", "bloqueado")
    op.drop_column("usuarios", "avatar_url")
    op.drop_column("usuarios", "empresa_id")
    op.drop_table("empresas")
