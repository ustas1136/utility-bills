from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property import Property, PropertyService


class PropertyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, property_id: int) -> Property | None:
        return await self.db.get(Property, property_id)

    async def list_for_households(
        self,
        household_ids: list[int],
        type_: str | None = None,
        include_archived: bool = False,
    ) -> list[Property]:
        stmt = select(Property).where(Property.household_id.in_(household_ids))
        if type_:
            stmt = stmt.where(Property.type == type_)
        if not include_archived:
            stmt = stmt.where(Property.is_archived.is_(False))
        stmt = stmt.order_by(Property.created_at)
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        household_id: int,
        type_: str,
        name: str,
        address: str | None,
        metadata_json: dict,
        created_by: int,
    ) -> Property:
        p = Property(
            household_id=household_id,
            type=type_,
            name=name,
            address=address,
            metadata_json=metadata_json,
            created_by=created_by,
        )
        self.db.add(p)
        await self.db.flush()
        return p

    async def list_services(self, property_id: int) -> list[PropertyService]:
        stmt = (
            select(PropertyService)
            .where(PropertyService.property_id == property_id)
            .order_by(PropertyService.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_service(
        self, property_id: int, service_id: int
    ) -> PropertyService | None:
        stmt = select(PropertyService).where(
            PropertyService.id == service_id,
            PropertyService.property_id == property_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def find_service_by_type(
        self, property_id: int, service_type_id: int
    ) -> PropertyService | None:
        stmt = select(PropertyService).where(
            PropertyService.property_id == property_id,
            PropertyService.service_type_id == service_type_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create_service(
        self,
        property_id: int,
        service_type_id: int,
        account_number: str | None,
        provider: str | None,
        started_at,
        closed_at,
    ) -> PropertyService:
        ps = PropertyService(
            property_id=property_id,
            service_type_id=service_type_id,
            account_number=account_number,
            provider=provider,
            started_at=started_at,
            closed_at=closed_at,
        )
        self.db.add(ps)
        await self.db.flush()
        return ps