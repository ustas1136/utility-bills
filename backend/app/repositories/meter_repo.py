from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meter import Meter, Reading


class MeterRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, meter_id: int) -> Meter | None:
        return await self.db.get(Meter, meter_id)

    async def list_by_property_service(
        self, property_service_id: int
    ) -> list[Meter]:
        stmt = (
            select(Meter)
            .where(Meter.property_service_id == property_service_id)
            .order_by(Meter.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_active_for_service(
        self, property_service_id: int
    ) -> Meter | None:
        stmt = select(Meter).where(
            Meter.property_service_id == property_service_id,
            Meter.replaced_at.is_(None),
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(
        self,
        property_service_id: int,
        serial_number: str | None,
        initial_value: Decimal,
        unit: str,
        installed_at: date | None,
    ) -> Meter:
        m = Meter(
            property_service_id=property_service_id,
            serial_number=serial_number,
            initial_value=initial_value,
            unit=unit,
            installed_at=installed_at,
        )
        self.db.add(m)
        await self.db.flush()
        return m

    async def mark_replaced(
        self,
        old_meter: Meter,
        replaced_at: date,
        new_meter_id: int,
    ) -> None:
        old_meter.replaced_at = replaced_at
        old_meter.replaced_by_meter_id = new_meter_id
        await self.db.flush()

    # ── Readings ────────────────────────────────────────────────

    async def get_reading(self, reading_id: int) -> Reading | None:
        return await self.db.get(Reading, reading_id)

    async def list_readings(
        self,
        meter_id: int,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[Reading]:
        stmt = select(Reading).where(Reading.meter_id == meter_id)
        if date_from:
            stmt = stmt.where(Reading.taken_at >= date_from)
        if date_to:
            stmt = stmt.where(Reading.taken_at <= date_to)
        stmt = stmt.order_by(Reading.taken_at.desc())
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_previous_reading(
        self, meter_id: int, before: date
    ) -> Reading | None:
        """Последнее показание до указанной даты (не включая её)."""
        stmt = (
            select(Reading)
            .where(
                Reading.meter_id == meter_id,
                Reading.taken_at < before,
            )
            .order_by(Reading.taken_at.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_reading_on_date(
        self, meter_id: int, taken_at: date
    ) -> Reading | None:
        stmt = select(Reading).where(
            Reading.meter_id == meter_id,
            Reading.taken_at == taken_at,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create_reading(
        self,
        meter_id: int,
        value: Decimal,
        taken_at: date,
        source: str,
        created_by: int | None,
    ) -> Reading:
        r = Reading(
            meter_id=meter_id,
            value=value,
            taken_at=taken_at,
            source=source,
            created_by=created_by,
        )
        self.db.add(r)
        await self.db.flush()
        return r