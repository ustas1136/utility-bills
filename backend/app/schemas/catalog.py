from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ServiceTypeBase(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(pattern=r"^(utility|tax|insurance|other)$")
    unit: str | None = Field(None, max_length=32)
    periodicity: str = Field(pattern=r"^(monthly|quarterly|yearly|one_time)$")
    metered: bool = False
    applicable_object_types: list[str] = Field(default_factory=list)


class ServiceTypeCreate(ServiceTypeBase):
    pass


class ServiceTypeRead(ServiceTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_system: bool
    created_by: int | None
    created_at: datetime


class TariffBase(BaseModel):
    service_type_id: int
    household_id: int | None = None
    region: str | None = Field(None, max_length=100)
    rate: Decimal = Field(gt=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    valid_from: date
    valid_to: date | None = None


class TariffCreate(TariffBase):
    pass


class TariffRead(TariffBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime