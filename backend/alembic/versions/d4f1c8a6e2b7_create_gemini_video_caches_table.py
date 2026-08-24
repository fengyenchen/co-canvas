"""create gemini video caches table

Revision ID: d4f1c8a6e2b7
Revises: 7a8d3f12c4b9
Create Date: 2026-08-25 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "d4f1c8a6e2b7"
down_revision: str | Sequence[str] | None = "7a8d3f12c4b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "gemini_video_caches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "credential_fingerprint",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_uri", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "credential_fingerprint",
            "source_hash",
            name="uq_gemini_video_caches_credential_source",
        ),
    )
    op.create_index(
        op.f("ix_gemini_video_caches_credential_fingerprint"),
        "gemini_video_caches",
        ["credential_fingerprint"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gemini_video_caches_expires_at"),
        "gemini_video_caches",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_gemini_video_caches_expires_at"),
        table_name="gemini_video_caches",
    )
    op.drop_index(
        op.f("ix_gemini_video_caches_credential_fingerprint"),
        table_name="gemini_video_caches",
    )
    op.drop_table("gemini_video_caches")
