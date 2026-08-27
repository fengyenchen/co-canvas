"""create research events table

Revision ID: a3d7e9c1b5f2
Revises: f2a6c8d9e1b3
Create Date: 2026-08-27 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a3d7e9c1b5f2"
down_revision: str | Sequence[str] | None = "f2a6c8d9e1b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "research_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("client_event_id", sa.String(length=255), nullable=False),
        sa.Column("actor_id", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("context_node_id", sa.String(length=255), nullable=True),
        sa.Column("ai_mode", sa.String(length=20), nullable=False),
        sa.Column("edited", sa.Boolean(), nullable=False),
        sa.Column("decision_time_ms", sa.Integer(), nullable=False),
        sa.Column("node_count", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint(
            "project_id",
            "client_event_id",
            name="uq_research_events_project_client_event",
        ),
    )
    op.create_index(
        op.f("ix_research_events_project_id"),
        "research_events",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_research_events_project_id"),
        table_name="research_events",
    )
    op.drop_table("research_events")
