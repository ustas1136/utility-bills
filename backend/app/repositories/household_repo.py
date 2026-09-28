from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household, HouseholdMember


class HouseholdRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, household_id: int) -> Household | None:
        return await self.db.get(Household, household_id)

    async def list_for_user(self, user_id: int) -> list[tuple[Household, str]]:
        stmt = (
            select(Household, HouseholdMember.role)
            .join(HouseholdMember, HouseholdMember.household_id == Household.id)
            .where(HouseholdMember.user_id == user_id)
            .order_by(Household.created_at)
        )
        return list((await self.db.execute(stmt)).all())

    async def create(
        self,
        name: str,
        base_currency: str,
        owner_id: int,
        is_personal: bool = False,
    ) -> Household:
        household = Household(
            name=name,
            base_currency=base_currency,
            created_by=owner_id,
            is_personal=is_personal,
        )
        self.db.add(household)
        await self.db.flush()
        self.db.add(
            HouseholdMember(household_id=household.id, user_id=owner_id, role="owner")
        )
        await self.db.flush()
        return household

    async def get_membership(
        self, household_id: int, user_id: int
    ) -> HouseholdMember | None:
        stmt = select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_members(self, household_id: int) -> list[HouseholdMember]:
        stmt = (
            select(HouseholdMember)
            .where(HouseholdMember.household_id == household_id)
            .order_by(HouseholdMember.joined_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def update_member_role(
        self, membership: HouseholdMember, new_role: str
    ) -> HouseholdMember:
        membership.role = new_role
        await self.db.flush()
        return membership

    async def remove_member(self, membership: HouseholdMember) -> None:
        await self.db.delete(membership)
        await self.db.flush()