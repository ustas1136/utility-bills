from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import can_manage
from app.models.service_type import ServiceType
from app.models.tariff import Tariff
from app.repositories.household_repo import HouseholdRepository
from app.repositories.service_type_repo import ServiceTypeRepository
from app.repositories.tariff_repo import TariffRepository
from app.schemas.catalog import ServiceTypeCreate, TariffCreate


class CatalogService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.service_types = ServiceTypeRepository(db)
        self.tariffs = TariffRepository(db)
        self.households = HouseholdRepository(db)

    # ── ServiceType ─────────────────────────────────────────────

    async def list_service_types(
        self,
        user_id: int,
        category: str | None = None,
        object_type: str | None = None,
    ) -> list[ServiceType]:
        return await self.service_types.list_available(
            user_id, category=category, object_type=object_type
        )

    async def create_service_type(
        self, user_id: int, data: ServiceTypeCreate
    ) -> ServiceType:
        if await self.service_types.get_by_code(data.code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Service type with code '{data.code}' already exists",
            )
        st = await self.service_types.create(
            code=data.code,
            name=data.name,
            category=data.category,
            unit=data.unit,
            periodicity=data.periodicity,
            metered=data.metered,
            applicable_object_types=data.applicable_object_types,
            created_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(st)
        return st

    async def delete_service_type(self, st_id: int, user_id: int) -> None:
        st = await self.service_types.get_by_id(st_id)
        if not st:
            raise HTTPException(status_code=404, detail="Service type not found")
        if st.is_system:
            raise HTTPException(
                status_code=400, detail="Cannot delete system service type"
            )
        if st.created_by != user_id:
            raise HTTPException(
                status_code=403, detail="Not your service type"
            )
        await self.db.delete(st)
        await self.db.commit()

    # ── Tariff ──────────────────────────────────────────────────

    async def _user_household_ids(self, user_id: int) -> list[int]:
        rows = await self.households.list_for_user(user_id)
        return [h.id for h, _ in rows]

    async def list_tariffs(
        self,
        user_id: int,
        service_type_id: int | None = None,
        on_date: date | None = None,
    ) -> list[Tariff]:
        household_ids = await self._user_household_ids(user_id)
        return await self.tariffs.list_visible(
            household_ids, service_type_id=service_type_id, on_date=on_date
        )

    async def create_tariff(self, user_id: int, data: TariffCreate) -> Tariff:
        # Проверим service_type существует
        st = await self.service_types.get_by_id(data.service_type_id)
        if not st:
            raise HTTPException(
                status_code=404, detail="Service type not found"
            )

        # Если привязан к household — проверим права
        if data.household_id is not None:
            membership = await self.households.get_membership(
                data.household_id, user_id
            )
            if not membership or not can_manage(membership.role):
                raise HTTPException(
                    status_code=403,
                    detail="Cannot create tariff for this household",
                )

        # Валидация дат
        if data.valid_to and data.valid_to < data.valid_from:
            raise HTTPException(
                status_code=422, detail="valid_to must be >= valid_from"
            )

        tariff = await self.tariffs.create(
            service_type_id=data.service_type_id,
            household_id=data.household_id,
            region=data.region,
            rate=data.rate,
            currency=data.currency,
            valid_from=data.valid_from,
            valid_to=data.valid_to,
        )
        await self.db.commit()
        await self.db.refresh(tariff)
        return tariff
    
    async def delete_tariff(self, tariff_id: int, user_id: int) -> None:
        tariff = await self.tariffs.get_by_id(tariff_id)
        if not tariff:
            raise HTTPException(status_code=404, detail="Tariff not found")
        # Проверяем права: если привязан к household — только admin+
        if tariff.household_id is not None:
            membership = await self.households.get_membership(
                tariff.household_id, user_id
            )
            if not membership or not can_manage(membership.role):
                raise HTTPException(
                    status_code=403,
                    detail="Cannot delete tariff of this household",
                )
        await self.db.delete(tariff)
        await self.db.commit()