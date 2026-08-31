import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthAccountEvent(Base):
    __tablename__ = "auth_account_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('cleanup_expired', 'cleanup_permanent_bounce', 'welcome_sent')",
            name="ck_auth_account_events_type",
        ),
        UniqueConstraint(
            "event_type",
            "user_hash",
            name="uq_auth_account_events_type_user_hash",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    user_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
