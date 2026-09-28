from typing import TYPE_CHECKING

from sqlalchemy import ARRAY, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.tariff import Tariff


class ServiceType(Base, TimestampMixin):
    __tablename__ = "service_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    unit: Mapped[str | None] = mapped_column(String(32))
    periodicity: Mapped[str] = mapped_column(String(20), nullable=False)
    metered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    applicable_object_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)), nullable=False, default=list
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    tariffs: Mapped[list["Tariff"]] = relationship(
        back_populates="service_type",
        cascade="all, delete-orphan",
        lazy="selectin",
    )