from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_role
from app.models.household import HouseholdMember
from app.models.property import Property, PropertyService
from app.repositories.household_repo import HouseholdRepository
from app.repositories.property_repo import PropertyRepository
from app.repositories.service_type_repo import ServiceTypeRepository
from app.schemas.property import (
    PropertyCreate,
    PropertyServiceCreate,
    PropertyServiceUpdate,
    PropertyUpdate,
)


class PropertyServiceService:  # без шуток: сервис для PropertyService
    def __init__(self, db: AsyncSession):
        self.db = db
        self.properties = PropertyRepository(db)
        self.households = HouseholdRepository(db)
        self.service_types = ServiceTypeRepository(db)

    # ── helpers ─────────────────────────────────────────────────

    async def _user_household_ids(self, user_id: int) -> list[int]:
        rows = await self.households.list_for_user(user_id)
        return [h.id for h, _ in rows]

    async def _membership_for_property(
        self, prop: Property, user_id: int
    ) -> HouseholdMember:
        membership = await self.households.get_membership(
            prop.household_id, user_id
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Property not found",
            )
        return membership

    # ── Property ────────────────────────────────────────────────

    async def list_properties(
        self,
        user_id: int,
        type_: str | None = None,
        include_archived: bool = False,
    ) -> list[Property]:
        ids = await self._user_household_ids(user_id)
        if not ids:
            return []
        return await self.properties.list_for_households(
            ids, type_=type_, include_archived=include_archived
        )

    async def get_property(self, property_id: int, user_id: int) -> Property:
        prop = await self.properties.get_by_id(property_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        await self._membership_for_property(prop, user_id)
        return prop

    async def create_property(
        self, user_id: int, data: PropertyCreate
    ) -> Property:
        membership = await self.households.get_membership(
            data.household_id, user_id
        )
        if not membership:
            raise HTTPException(
                status_code=404, detail="Household not found"
            )
        require_role(membership.role, "member")

        prop = await self.properties.create(
            household_id=data.household_id,
            type_=data.type,
            name=data.name,
            address=data.address,
            metadata_json=data.metadata_json,
            created_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(prop)
        return prop

    async def update_property(
        self, property_id: int, user_id: int, data: PropertyUpdate
    ) -> Property:
        prop = await self.get_property(property_id, user_id)
        membership = await self._membership_for_property(prop, user_id)
        require_role(membership.role, "member")

        # Архивация — только admin+
        if data.is_archived is not None:
            require_role(membership.role, "admin")
            prop.is_archived = data.is_archived

        if data.name is not None:
            prop.name = data.name
        if data.address is not None:
            prop.address = data.address
        if data.metadata_json is not None:
            prop.metadata_json = data.metadata_json

        await self.db.commit()
        await self.db.refresh(prop)
        return prop

    async def archive_property(self, property_id: int, user_id: int) -> None:
        prop = await self.get_property(property_id, user_id)
        membership = await self._membership_for_property(prop, user_id)
        require_role(membership.role, "admin")
        prop.is_archived = True
        await self.db.commit()

    # ── PropertyService ─────────────────────────────────────────

    async def list_services(
        self, property_id: int, user_id: int
    ) -> list[PropertyService]:
        await self.get_property(property_id, user_id)
        return await self.properties.list_services(property_id)

    async def add_service(
        self, property_id: int, user_id: int, data: PropertyServiceCreate
    ) -> PropertyService:
        prop = await self.get_property(property_id, user_id)
        membership = await self._membership_for_property(prop, user_id)
        require_role(membership.role, "member")

        st = await self.service_types.get_by_id(data.service_type_id)
        if not st:
            raise HTTPException(
                status_code=404, detail="Service type not found"
            )

        # Проверка совместимости: услуга применима к типу объекта
        if prop.type not in st.applicable_object_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"Service '{st.code}' is not applicable "
                    f"to property type '{prop.type}'"
                ),
            )

        if await self.properties.find_service_by_type(
            property_id, data.service_type_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This service is already attached to the property",
            )

        ps = await self.properties.create_service(
            property_id=property_id,
            service_type_id=data.service_type_id,
            account_number=data.account_number,
            provider=data.provider,
            started_at=data.started_at,
            closed_at=data.closed_at,
        )
        await self.db.commit()
        await self.db.refresh(ps)
        return ps

    async def update_service(
        self,
        property_id: int,
        service_id: int,
        user_id: int,
        data: PropertyServiceUpdate,
    ) -> PropertyService:
        await self.get_property(property_id, user_id)
        ps = await self.properties.get_service(property_id, service_id)
        if not ps:
            raise HTTPException(status_code=404, detail="Service not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(ps, field, value)
        await self.db.commit()
        await self.db.refresh(ps)
        return ps

    async def remove_service(
        self, property_id: int, service_id: int, user_id: int
    ) -> None:
        prop = await self.get_property(property_id, user_id)
        membership = await self._membership_for_property(prop, user_id)
        require_role(membership.role, "admin")

        ps = await self.properties.get_service(property_id, service_id)
        if not ps:
            raise HTTPException(status_code=404, detail="Service not found")
        await self.db.delete(ps)
        await self.db.commit()