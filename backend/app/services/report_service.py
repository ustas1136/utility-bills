from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.household_repo import HouseholdRepository
from app.repositories.report_repo import ReportRepository
from app.schemas.reports import (
    ByPropertyReport,
    ConsumptionReport,
    ExpenseByMonthItem,
    ExpenseByPropertyItem,
    ExpensesReport,
    UpcomingItem,
    UpcomingReport,
)


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.reports = ReportRepository(db)
        self.households = HouseholdRepository(db)

    async def _household_ids(self, user_id: int) -> list[int]:
        rows = await self.households.list_for_user(user_id)
        return [h.id for h, _ in rows]

    async def expenses(
        self,
        user_id: int,
        from_date: date,
        to_date: date,
        mode: str = "paid",
    ) -> ExpensesReport:
        hh = await self._household_ids(user_id)
        rows = await self.reports.expenses_by_month(hh, from_date, to_date, mode)
        items = [
            ExpenseByMonthItem(
                month=r["month"],
                category=r["category"],
                amount=Decimal(r["amount"]),
                currency=r["currency"],
            )
            for r in rows
        ]
        return ExpensesReport(
            from_date=from_date, to_date=to_date, mode=mode, items=items
        )

    async def by_property(
        self,
        user_id: int,
        from_date: date,
        to_date: date,
        mode: str = "paid",
    ) -> ByPropertyReport:
        hh = await self._household_ids(user_id)
        rows = await self.reports.expenses_by_property(
            hh, from_date, to_date, mode
        )
        items = [
            ExpenseByPropertyItem(
                property_id=r["property_id"],
                property_name=r["property_name"],
                property_type=r["property_type"],
                amount=Decimal(r["amount"]),
                currency=r["currency"],
            )
            for r in rows
        ]
        return ByPropertyReport(
            from_date=from_date, to_date=to_date, mode=mode, items=items
        )

    async def consumption(
        self, user_id: int, from_date: date, to_date: date
    ) -> ConsumptionReport:
        hh = await self._household_ids(user_id)
        rows = await self.reports.consumption(hh, from_date, to_date)
        return ConsumptionReport(
            from_date=from_date,
            to_date=to_date,
            items=[
                {
                    "service_type_code": r["service_type_code"],
                    "service_type_name": r["service_type_name"],
                    "unit": r["unit"],
                    "total_consumption": Decimal(
                        r["total_consumption"] or 0
                    ),
                }
                for r in rows
            ],
        )

    async def upcoming(
        self, user_id: int, days: int = 30
    ) -> UpcomingReport:
        hh = await self._household_ids(user_id)
        rows = await self.reports.upcoming(hh, days)
        return UpcomingReport(
            items=[
                UpcomingItem(
                    charge_id=r["charge_id"],
                    property_name=r["property_name"],
                    service_name=r["service_name"],
                    amount=Decimal(r["amount"]),
                    paid_amount=Decimal(r["paid_amount"]),
                    currency=r["currency"],
                    due_date=r["due_date"],
                    days_left=r["days_left"],
                    status=r["status"],
                )
                for r in rows
            ]
        )

    async def export_csv(
        self,
        user_id: int,
        from_date: date,
        to_date: date,
        mode: str = "paid",
    ) -> str:
        """CSV-строка для экспорта расходов по месяцам."""
        report = await self.expenses(user_id, from_date, to_date, mode)
        lines = ["month,category,amount,currency"]
        for item in report.items:
            lines.append(
                f"{item.month},{item.category},{item.amount},{item.currency}"
            )
        return "\n".join(lines) + "\n"