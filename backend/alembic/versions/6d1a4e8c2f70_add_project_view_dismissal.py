"""add project view dismissal

Revision ID: 6d1a4e8c2f70
Revises: 2b7f4d9a6c31
Create Date: 2026-08-31 23:30:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "6d1a4e8c2f70"
down_revision: str | Sequence[str] | None = "2b7f4d9a6c31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "project_views",
        sa.Column(
            "dismissed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("project_views", "dismissed_at")
