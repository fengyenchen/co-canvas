"""create project views table

Revision ID: 2b7f4d9a6c31
Revises: 8f3a1c7d9e20
Create Date: 2026-08-31 18:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "2b7f4d9a6c31"
down_revision: str | Sequence[str] | None = "8f3a1c7d9e20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "project_views",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "viewed_at",
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
        sa.UniqueConstraint(
            "project_id",
            "user_id",
            name="uq_project_views_project_user",
        ),
    )
    op.create_index(
        op.f("ix_project_views_project_id"),
        "project_views",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_views_user_id"),
        "project_views",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_project_views_user_id"), table_name="project_views")
    op.drop_index(
        op.f("ix_project_views_project_id"),
        table_name="project_views",
    )
    op.drop_table("project_views")
