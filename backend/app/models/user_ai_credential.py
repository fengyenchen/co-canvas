import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserAiCredential(Base):
    __tablename__ = "user_ai_credentials"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('gemini')",
            name="ck_user_ai_credentials_provider",
        ),
        CheckConstraint(
            "status IN ('unverified', 'valid', 'invalid')",
            name="ck_user_ai_credentials_status",
        ),
        UniqueConstraint(
            "user_id",
            "provider",
            name="uq_user_ai_credentials_user_provider",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="gemini",
        server_default=text("'gemini'"),
    )
    encrypted_api_key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    key_hint: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unverified",
        server_default=text("'unverified'"),
    )
    last_validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
