from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.property import PropertyService


class Charge(Base, TimestampMixin):
    __tablename__ = "charges"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_period_order"),
        CheckConstraint("amount >= 0", name="ck_amount_non_negative"),
        Index("ix_charges_service_due", "property_service_id", "due_date"),
        Index("ix_charges_status_due", "status", "due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_service_id: Mapped[int] = mapped_column(
        ForeignKey("property_services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB"
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual"
    )
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    property_service: Mapped["PropertyService"] = relationship(
        back_populates="charges"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="charge",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    charge_id: Mapped[int] = mapped_column(
        ForeignKey("charges.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB"
    )
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    method: Mapped[str] = mapped_column(
        String(20), nullable=False, default="other"
    )
    external_id: Mapped[str | None] = mapped_column(String(128))
    comment: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    charge: Mapped["Charge"] = relationship(back_populates="payments")