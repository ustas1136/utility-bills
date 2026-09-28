from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class MeterBase(BaseModel):
    serial_number: str | None = Field(None, max_length=100)
    initial_value: Decimal = Field(default=Decimal("0"), ge=0)
    unit: str = Field(min_length=1, max_length=32)
    installed_at: date | None = None


class MeterCreate(MeterBase):
    property_service_id: int


class MeterUpdate(BaseModel):
    serial_number: str | None = Field(None, max_length=100)
    unit: str | None = Field(None, min_length=1, max_length=32)


class MeterRead(MeterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property_service_id: int
    replaced_at: date | None
    replaced_by_meter_id: int | None
    created_at: datetime


class MeterReplace(BaseModel):
    """Замена счётчика: старый помечается, создаётся новый."""

    replaced_at: date
    serial_number: str | None = Field(None, max_length=100)
    initial_value: Decimal = Field(ge=0)
    unit: str | None = Field(None, min_length=1, max_length=32)
    installed_at: date | None = None


class ReadingCreate(BaseModel):
    value: Decimal = Field(ge=0)
    taken_at: date
    # force=True — обойти проверку монотонности (например, при коррекции)
    force: bool = False


class ReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meter_id: int
    value: Decimal
    taken_at: date
    source: str
    created_at: datetime