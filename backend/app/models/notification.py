from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.charge import Charge
    from app.models.reminder import ReminderRule


class Device(Base, TimestampMixin):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fcm_token: Mapped[str] = mapped_column(
        String(512), nullable=False, unique=True
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(200))
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    is_active: Mapped[bool] = mapped_column(
        nullable=False, default=True, index=True
    )


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="ck_attempts_non_negative"),
        # Защита от дублей: одно уведомление на (пользователь, charge,
        # правило, канал) за конкретную дату.
        # NULL в charge_id/reminder_rule_id означают «общее правило» —
        # PostgreSQL в UNIQUE-констрейнте считает NULL-ы разными,
        # поэтому дедупликация общих правил делается в сервисе.
        UniqueConstraint(
            "user_id",
            "charge_id",
            "reminder_rule_id",
            "channel",
            "scheduled_date",
            name="uq_notification_dedup",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    charge_id: Mapped[int | None] = mapped_column(
        ForeignKey("charges.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reminder_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("reminder_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    scheduled_date: Mapped[date] = mapped_column(
        Date, nullable=False, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    charge: Mapped["Charge | None"] = relationship(lazy="selectin")
    reminder_rule: Mapped["ReminderRule | None"] = relationship(lazy="selectin")