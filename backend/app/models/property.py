from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.charge import Charge
    from app.models.meter import Meter
    from app.models.service_type import ServiceType


class Property(Base, TimestampMixin):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    # Специфичные для типа атрибуты: VIN, кадастр, площадь и т.п.
    # В БД колонка называется "metadata", атрибут metadata_json —
    # чтобы не конфликтовать с Base.metadata
    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    services: Mapped[list["PropertyService"]] = relationship(
        back_populates="property",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PropertyService(Base, TimestampMixin):
    __tablename__ = "property_services"
    __table_args__ = (
        UniqueConstraint(
            "property_id", "service_type_id", name="uq_prop_service"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_type_id: Mapped[int] = mapped_column(
        ForeignKey("service_types.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_number: Mapped[str | None] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    started_at: Mapped[date | None] = mapped_column(Date)
    closed_at: Mapped[date | None] = mapped_column(Date)

    property: Mapped["Property"] = relationship(back_populates="services")
    service_type: Mapped["ServiceType"] = relationship(lazy="joined")
    meters: Mapped[list["Meter"]] = relationship(
        back_populates="property_service",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    charges: Mapped[list["Charge"]] = relationship(
        back_populates="property_service",
        cascade="all, delete-orphan",
        lazy="selectin",
    )