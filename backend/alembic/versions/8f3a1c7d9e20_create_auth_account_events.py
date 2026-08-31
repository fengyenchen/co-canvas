"""create auth account events

Revision ID: 8f3a1c7d9e20
Revises: 5c8e2a1f9d40
Create Date: 2026-08-31 13:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "8f3a1c7d9e20"
down_revision: str | Sequence[str] | None = "5c8e2a1f9d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auth_account_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("user_hash", sa.String(length=64), nullable=False),
        sa.Column("email_hash", sa.String(length=64), nullable=False),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "event_type IN ('cleanup_expired', 'cleanup_permanent_bounce', 'welcome_sent')",
            name="ck_auth_account_events_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_type",
            "user_hash",
            name="uq_auth_account_events_type_user_hash",
        ),
    )
    op.create_index(
        op.f("ix_auth_account_events_event_type"),
        "auth_account_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_auth_account_events_occurred_at"),
        "auth_account_events",
        ["occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_auth_account_events_occurred_at"),
        table_name="auth_account_events",
    )
    op.drop_index(
        op.f("ix_auth_account_events_event_type"),
        table_name="auth_account_events",
    )
    op.drop_table("auth_account_events")
