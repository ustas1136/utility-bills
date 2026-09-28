from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_type import ServiceType


class ServiceTypeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, service_type_id: int) -> ServiceType | None:
        return await self.db.get(ServiceType, service_type_id)

    async def get_by_code(self, code: str) -> ServiceType | None:
        stmt = select(ServiceType).where(ServiceType.code == code)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_available(
        self,
        user_id: int,
        category: str | None = None,
        object_type: str | None = None,
    ) -> list[ServiceType]:
        """Системные + созданные самим пользователем."""
        stmt = select(ServiceType).where(
            or_(
                ServiceType.is_system.is_(True),
                ServiceType.created_by == user_id,
            )
        )
        if category:
            stmt = stmt.where(ServiceType.category == category)
        if object_type:
            stmt = stmt.where(ServiceType.applicable_object_types.any(object_type))
        stmt = stmt.order_by(ServiceType.is_system.desc(), ServiceType.name)
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        code: str,
        name: str,
        category: str,
        unit: str | None,
        periodicity: str,
        metered: bool,
        applicable_object_types: list[str],
        created_by: int,
    ) -> ServiceType:
        st = ServiceType(
            code=code,
            name=name,
            category=category,
            unit=unit,
            periodicity=periodicity,
            metered=metered,
            applicable_object_types=applicable_object_types,
            is_system=False,
            created_by=created_by,
        )
        self.db.add(st)
        await self.db.flush()
        return st