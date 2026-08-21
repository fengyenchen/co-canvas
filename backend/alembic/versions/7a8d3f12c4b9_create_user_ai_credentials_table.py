"""create user ai credentials table

Revision ID: 7a8d3f12c4b9
Revises: b43779e6561a
Create Date: 2026-08-21 16:10:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "7a8d3f12c4b9"
down_revision: str | Sequence[str] | None = "b43779e6561a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "user_ai_credentials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "provider",
            sa.String(length=20),
            server_default=sa.text("'gemini'"),
            nullable=False,
        ),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("key_hint", sa.String(length=4), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'unverified'"),
            nullable=False,
        ),
        sa.Column(
            "last_validated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "provider IN ('gemini')",
            name="ck_user_ai_credentials_provider",
        ),
        sa.CheckConstraint(
            "status IN ('unverified', 'valid', 'invalid')",
            name="ck_user_ai_credentials_status",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "provider",
            name="uq_user_ai_credentials_user_provider",
        ),
    )
    op.create_index(
        op.f("ix_user_ai_credentials_user_id"),
        "user_ai_credentials",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_user_ai_credentials_user_id"),
        table_name="user_ai_credentials",
    )
    op.drop_table("user_ai_credentials")
