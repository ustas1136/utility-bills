from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ExpenseByMonthItem(BaseModel):
    month: str  # "2026-09"
    category: str  # utility | tax | insurance | other
    amount: Decimal
    currency: str


class ExpensesReport(BaseModel):
    from_date: date
    to_date: date
    mode: str
    items: list[ExpenseByMonthItem]


class ExpenseByPropertyItem(BaseModel):
    property_id: int
    property_name: str
    property_type: str
    amount: Decimal
    currency: str


class ByPropertyReport(BaseModel):
    from_date: date
    to_date: date
    mode: str
    items: list[ExpenseByPropertyItem]


class ConsumptionItem(BaseModel):
    service_type_code: str
    service_type_name: str
    unit: str | None
    total_consumption: Decimal


class ConsumptionReport(BaseModel):
    from_date: date
    to_date: date
    items: list[ConsumptionItem]


class UpcomingItem(BaseModel):
    charge_id: int
    property_name: str
    service_name: str
    amount: Decimal
    paid_amount: Decimal
    currency: str
    due_date: date
    days_left: int
    status: str


class UpcomingReport(BaseModel):
    items: list[UpcomingItem]