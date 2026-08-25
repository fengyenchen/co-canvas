"""create project versions table

Revision ID: f2a6c8d9e1b3
Revises: e8c4b7a2d1f0
Create Date: 2026-08-25 21:30:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2a6c8d9e1b3"
down_revision: str | Sequence[str] | None = "e8c4b7a2d1f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "project_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column(
            "kind",
            sa.String(length=30),
            server_default=sa.text("'manual'"),
            nullable=False,
        ),
        sa.Column("document", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_versions_project_id"),
        "project_versions",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_versions_created_at"),
        "project_versions",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_project_versions_created_at"),
        table_name="project_versions",
    )
    op.drop_index(
        op.f("ix_project_versions_project_id"),
        table_name="project_versions",
    )
    op.drop_table("project_versions")
