from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.property import PropertyService


class Meter(Base, TimestampMixin):
    __tablename__ = "meters"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_service_id: Mapped[int] = mapped_column(
        ForeignKey("property_services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    serial_number: Mapped[str | None] = mapped_column(String(100))
    initial_value: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), nullable=False, default=Decimal("0")
    )
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    installed_at: Mapped[date | None] = mapped_column(Date)
    replaced_at: Mapped[date | None] = mapped_column(Date, index=True)
    replaced_by_meter_id: Mapped[int | None] = mapped_column(
        ForeignKey("meters.id", ondelete="SET NULL"), nullable=True
    )

    property_service: Mapped["PropertyService"] = relationship(
        back_populates="meters", lazy="joined"
    )
    readings: Mapped[list["Reading"]] = relationship(
        back_populates="meter",
        cascade="all, delete-orphan",
        order_by="Reading.taken_at",
    )


class Reading(Base, TimestampMixin):
    __tablename__ = "readings"
    __table_args__ = (
        UniqueConstraint("meter_id", "taken_at", name="uq_meter_reading_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meter_id: Mapped[int] = mapped_column(
        ForeignKey("meters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    taken_at: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual"
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    meter: Mapped["Meter"] = relationship(back_populates="readings")