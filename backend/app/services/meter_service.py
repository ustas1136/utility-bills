from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_role
from app.models.meter import Meter, Reading
from app.repositories.household_repo import HouseholdRepository
from app.repositories.meter_repo import MeterRepository
from app.repositories.property_repo import PropertyRepository
from app.schemas.meter import (
    MeterCreate,
    MeterReplace,
    MeterUpdate,
    ReadingCreate,
)


class MeterService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.meters = MeterRepository(db)
        self.properties = PropertyRepository(db)
        self.households = HouseholdRepository(db)

    # ── helpers ─────────────────────────────────────────────────

    async def _ensure_access_to_property_service(
        self, property_service_id: int, user_id: int
    ) -> None:
        """Проверяет, что пользователь имеет доступ к услуге объекта."""
        # Находим property_service
        from app.models.property import PropertyService

        ps = await self.db.get(PropertyService, property_service_id)
        if not ps:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        prop = await self.properties.get_by_id(ps.property_id)
        if not prop:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        membership = await self.households.get_membership(
            prop.household_id, user_id
        )
        if not membership:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        require_role(membership.role, "member")

    async def _ensure_access_to_meter(
        self, meter: Meter, user_id: int
    ) -> None:
        await self._ensure_access_to_property_service(
            meter.property_service_id, user_id
        )

    # ── Meters ──────────────────────────────────────────────────

    async def create_meter(
        self, user_id: int, data: MeterCreate
    ) -> Meter:
        await self._ensure_access_to_property_service(
            data.property_service_id, user_id
        )

        # Проверим, что услуга поддерживает счётчик
        from app.models.property import PropertyService

        ps = await self.db.get(PropertyService, data.property_service_id)
        if not ps.service_type.metered:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="This service does not support meters",
            )

        # Проверим, что у услуги ещё нет активного счётчика
        existing = await self.meters.get_active_for_service(
            data.property_service_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Active meter already exists for this service. "
                    "Use /replace to swap meters."
                ),
            )

        m = await self.meters.create(
            property_service_id=data.property_service_id,
            serial_number=data.serial_number,
            initial_value=data.initial_value,
            unit=data.unit,
            installed_at=data.installed_at,
        )
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def list_meters(
        self, property_service_id: int, user_id: int
    ) -> list[Meter]:
        await self._ensure_access_to_property_service(
            property_service_id, user_id
        )
        return await self.meters.list_by_property_service(property_service_id)

    async def get_meter(self, meter_id: int, user_id: int) -> Meter:
        m = await self.meters.get_by_id(meter_id)
        if not m:
            raise HTTPException(status_code=404, detail="Meter not found")
        await self._ensure_access_to_meter(m, user_id)
        return m

    async def update_meter(
        self, meter_id: int, user_id: int, data: MeterUpdate
    ) -> Meter:
        m = await self.get_meter(meter_id, user_id)
        if data.serial_number is not None:
            m.serial_number = data.serial_number
        if data.unit is not None:
            m.unit = data.unit
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def replace_meter(
        self, meter_id: int, user_id: int, data: MeterReplace
    ) -> Meter:
        old = await self.get_meter(meter_id, user_id)
        if old.replaced_at:
            raise HTTPException(
                status_code=409, detail="Meter is already replaced"
            )

        new = await self.meters.create(
            property_service_id=old.property_service_id,
            serial_number=data.serial_number,
            initial_value=data.initial_value,
            unit=data.unit or old.unit,
            installed_at=data.installed_at or data.replaced_at,
        )
        await self.meters.mark_replaced(old, data.replaced_at, new.id)
        await self.db.commit()
        await self.db.refresh(new)
        return new

    # ── Readings ────────────────────────────────────────────────

    async def list_readings(
        self,
        meter_id: int,
        user_id: int,
        date_from=None,
        date_to=None,
    ) -> list[Reading]:
        await self.get_meter(meter_id, user_id)
        return await self.meters.list_readings(
            meter_id, date_from=date_from, date_to=date_to
        )

    async def add_reading(
        self, meter_id: int, user_id: int, data: ReadingCreate
    ) -> Reading:
        meter = await self.get_meter(meter_id, user_id)

        # Одна точка на дату
        existing = await self.meters.get_reading_on_date(meter_id, data.taken_at)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Reading on {data.taken_at} already exists",
            )

        if not data.force:
            prev = await self.meters.get_previous_reading(
                meter_id, data.taken_at
            )
            baseline = prev.value if prev else meter.initial_value
            if data.value < baseline:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=(
                        f"Reading {data.value} is less than previous "
                        f"{baseline}. Use force=true to override."
                    ),
                )

        r = await self.meters.create_reading(
            meter_id=meter_id,
            value=data.value,
            taken_at=data.taken_at,
            source="manual",
            created_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(r)
        return r

    async def delete_reading(
        self, meter_id: int, reading_id: int, user_id: int
    ) -> None:
        meter = await self.get_meter(meter_id, user_id)
        r = await self.meters.get_reading(reading_id)
        if not r or r.meter_id != meter.id:
            raise HTTPException(status_code=404, detail="Reading not found")
        await self.db.delete(r)
        await self.db.commit()