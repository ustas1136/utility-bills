from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Payment


class PaymentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, payment_id: int) -> Payment | None:
        return await self.db.get(Payment, payment_id)

    async def list_for_charge(self, charge_id: int) -> list[Payment]:
        stmt = (
            select(Payment)
            .where(Payment.charge_id == charge_id)
            .order_by(Payment.paid_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        charge_id: int,
        amount: Decimal,
        currency: str,
        paid_at: datetime,
        method: str,
        external_id: str | None,
        comment: str | None,
        created_by: int,
    ) -> Payment:
        p = Payment(
            charge_id=charge_id,
            amount=amount,
            currency=currency,
            paid_at=paid_at,
            method=method,
            external_id=external_id,
            comment=comment,
            created_by=created_by,
        )
        self.db.add(p)
        await self.db.flush()
        return p