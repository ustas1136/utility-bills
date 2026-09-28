from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

CHARGE_STATUS = r"^(pending|partial|paid|overdue|cancelled)$"
PAYMENT_METHOD = r"^(cash|card|bank_transfer|online|other)$"


class ChargeBase(BaseModel):
    property_service_id: int
    period_start: date
    period_end: date
    amount: Decimal = Field(ge=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    due_date: date
    notes: str | None = None


class ChargeCreate(ChargeBase):
    pass


class ChargeUpdate(BaseModel):
    amount: Decimal | None = Field(None, ge=0)
    due_date: date | None = None
    notes: str | None = None


class ChargeRead(ChargeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    source: str
    external_id: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    paid_amount: Decimal = Decimal("0")


class ChargeCalculateRequest(BaseModel):
    """Запрос авто-расчёта начисления по показаниям счётчика и тарифу."""

    property_service_id: int
    period_start: date
    period_end: date
    due_date: date
    notes: str | None = None


class PaymentBase(BaseModel):
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    paid_at: datetime
    method: str = Field(default="other", pattern=PAYMENT_METHOD)
    external_id: str | None = Field(None, max_length=128)
    comment: str | None = None


class PaymentCreate(PaymentBase):
    pass


class PaymentRead(PaymentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    charge_id: int
    created_by: int | None
    created_at: datetime