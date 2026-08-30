"""create resend webhook events table

Revision ID: 5c8e2a1f9d40
Revises: a3d7e9c1b5f2
Create Date: 2026-08-31 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "5c8e2a1f9d40"
down_revision: str | Sequence[str] | None = "a3d7e9c1b5f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resend_webhook_events",
        sa.Column("svix_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("email_hash", sa.String(length=64), nullable=True),
        sa.Column("outcome", sa.String(length=50), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("svix_id"),
    )


def downgrade() -> None:
    op.drop_table("resend_webhook_events")
