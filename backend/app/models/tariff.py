from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.service_type import ServiceType


class Tariff(Base, TimestampMixin):
    __tablename__ = "tariffs"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_type_id: Mapped[int] = mapped_column(
        ForeignKey("service_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    household_id: Mapped[int | None] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    region: Mapped[str | None] = mapped_column(String(100))
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    service_type: Mapped["ServiceType"] = relationship(back_populates="tariffs")