from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tariff import Tariff


class TariffRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tariff_id: int) -> Tariff | None:
        return await self.db.get(Tariff, tariff_id)

    async def list_visible(
        self,
        household_ids: list[int],
        service_type_id: int | None = None,
        on_date: date | None = None,
    ) -> list[Tariff]:
        """Глобальные (household_id IS NULL) + тарифы доступных household."""
        stmt = select(Tariff).where(
            or_(
                Tariff.household_id.is_(None),
                Tariff.household_id.in_(household_ids),
            )
        )
        if service_type_id:
            stmt = stmt.where(Tariff.service_type_id == service_type_id)
        if on_date:
            stmt = stmt.where(
                Tariff.valid_from <= on_date,
                or_(Tariff.valid_to.is_(None), Tariff.valid_to >= on_date),
            )
        stmt = stmt.order_by(Tariff.valid_from.desc())
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        service_type_id: int,
        household_id: int | None,
        region: str | None,
        rate,
        currency: str,
        valid_from: date,
        valid_to: date | None,
    ) -> Tariff:
        t = Tariff(
            service_type_id=service_type_id,
            household_id=household_id,
            region=region,
            rate=rate,
            currency=currency,
            valid_from=valid_from,
            valid_to=valid_to,
        )
        self.db.add(t)
        await self.db.flush()
        return t