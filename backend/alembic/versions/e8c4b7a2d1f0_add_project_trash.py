"""add project trash

Revision ID: e8c4b7a2d1f0
Revises: d4f1c8a6e2b7
Create Date: 2026-08-25 21:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e8c4b7a2d1f0"
down_revision: str | Sequence[str] | None = "d4f1c8a6e2b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "projects",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_projects_deleted_at"),
        "projects",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_projects_deleted_at"), table_name="projects")
    op.drop_column("projects", "deleted_at")
