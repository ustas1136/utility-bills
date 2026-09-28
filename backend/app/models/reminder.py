from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.charge import Charge
    from app.models.household import Household
    from app.models.service_type import ServiceType


class ReminderRule(Base, TimestampMixin):
    __tablename__ = "reminder_rules"
    __table_args__ = (
        CheckConstraint("days_before >= 0", name="ck_days_before_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NULL — правило применяется ко всем участникам household
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # NULL — правило для конкретного charge; иначе это общее правило
    charge_id: Mapped[int | None] = mapped_column(
        ForeignKey("charges.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # NULL — правило для конкретного типа услуги (например, "напомнить показания")
    service_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_types.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    days_before: Mapped[int] = mapped_column(Integer, nullable=False)
    channels: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)), nullable=False, default=list
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )

    household: Mapped["Household"] = relationship(lazy="selectin")
    charge: Mapped["Charge | None"] = relationship(lazy="selectin")
    service_type: Mapped["ServiceType | None"] = relationship(lazy="selectin")


class NotificationPreference(Base, TimestampMixin):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "channel", name="uq_user_channel"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    quiet_hours_start: Mapped[time | None] = mapped_column(Time)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time)