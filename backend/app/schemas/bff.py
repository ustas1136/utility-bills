from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

# ── Home ────────────────────────────────────────────────────

class HomeChargeItem(BaseModel):
    charge_id: int
    property_name: str
    service_name: str
    amount: Decimal
    paid_amount: Decimal
    currency: str
    due_date: date
    days_left: int
    status: str


class HomeNotificationItem(BaseModel):
    id: int
    channel: str
    title: str
    body: str
    status: str
    created_at: datetime


class HomeTotals(BaseModel):
    currency: str
    pending_amount: Decimal
    overdue_amount: Decimal


class HomeResponse(BaseModel):
    user_email: str
    household_count: int
    upcoming: list[HomeChargeItem]
    unread_notifications: list[HomeNotificationItem]
    totals: list[HomeTotals]


# ── Properties ─────────────────────────────────────────────

class PropertyServiceItem(BaseModel):
    property_service_id: int
    service_type_code: str
    service_type_name: str
    is_active: bool
    meter_count: int
    last_reading_value: Decimal | None
    last_reading_date: date | None


class PropertyListItem(BaseModel):
    property_id: int
    household_id: int
    type: str
    name: str
    address: str | None
    is_archived: bool
    service_count: int
    pending_amount: Decimal
    currency: str


class PropertiesResponse(BaseModel):
    items: list[PropertyListItem]


# ── Property detail ────────────────────────────────────────

class PropertyDetail(BaseModel):
    property_id: int
    household_id: int
    type: str
    name: str
    address: str | None
    metadata_json: dict
    is_archived: bool
    services: list[PropertyServiceItem]


# ── Charges (фильтры) ─────────────────────────────────────

class ChargeListItem(BaseModel):
    charge_id: int
    property_id: int
    property_name: str
    service_name: str
    amount: Decimal
    paid_amount: Decimal
    currency: str
    period_start: date
    period_end: date
    due_date: date
    status: str


class ChargesListResponse(BaseModel):
    items: list[ChargeListItem]
    total: int