import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def create_empty_document() -> dict[str, Any]:
    return {
        "version": 3,
        "nodes": [],
        "edges": [],
        "messages": [],
    }


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    owner_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="private",
        server_default=text("'private'"),
    )
    public_access_role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="viewer",
        server_default=text("'viewer'"),
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    document: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=create_empty_document,
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
