from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge


class ChargeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, charge_id: int) -> Charge | None:
        return await self.db.get(Charge, charge_id)

    async def list_for_property_service(
        self,
        property_service_id: int,
        status: str | None = None,
    ) -> list[Charge]:
        stmt = select(Charge).where(
            Charge.property_service_id == property_service_id
        )
        if status:
            stmt = stmt.where(Charge.status == status)
        stmt = stmt.order_by(Charge.period_end.desc(), Charge.id.desc())
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_for_household_services(
        self,
        property_service_ids: list[int],
        status: str | None = None,
        due_before: date | None = None,
    ) -> list[Charge]:
        if not property_service_ids:
            return []
        stmt = select(Charge).where(
            Charge.property_service_id.in_(property_service_ids)
        )
        if status:
            stmt = stmt.where(Charge.status == status)
        if due_before:
            stmt = stmt.where(Charge.due_date <= due_before)
        stmt = stmt.order_by(Charge.due_date, Charge.id)
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        property_service_id: int,
        period_start: date,
        period_end: date,
        amount: Decimal,
        currency: str,
        due_date: date,
        source: str,
        notes: str | None,
        created_by: int,
        external_id: str | None = None,
    ) -> Charge:
        c = Charge(
            property_service_id=property_service_id,
            period_start=period_start,
            period_end=period_end,
            amount=amount,
            currency=currency,
            due_date=due_date,
            status="pending",
            source=source,
            external_id=external_id,
            notes=notes,
            created_by=created_by,
        )
        self.db.add(c)
        await self.db.flush()
        return c

    async def paid_amount(self, charge_id: int) -> Decimal:
        from sqlalchemy import func

        from app.models.charge import Payment

        stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.charge_id == charge_id
        )
        return (await self.db.execute(stmt)).scalar_one()