from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))
    base_currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    locale: Mapped[str] = mapped_column(String(10), default="ru-RU", nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(50), default="Europe/Moscow", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)