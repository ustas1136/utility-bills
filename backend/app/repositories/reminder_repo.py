from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import NotificationPreference, ReminderRule


class ReminderRuleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, rule_id: int) -> ReminderRule | None:
        return await self.db.get(ReminderRule, rule_id)

    async def list_for_household(self, household_id: int) -> list[ReminderRule]:
        stmt = (
            select(ReminderRule)
            .where(ReminderRule.household_id == household_id)
            .order_by(ReminderRule.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_active_for_charge(
        self, charge_id: int
    ) -> list[ReminderRule]:
        stmt = select(ReminderRule).where(
            ReminderRule.charge_id == charge_id,
            ReminderRule.is_active.is_(True),
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_active_for_service_type(
        self, household_id: int, service_type_id: int
    ) -> list[ReminderRule]:
        stmt = select(ReminderRule).where(
            ReminderRule.household_id == household_id,
            ReminderRule.service_type_id == service_type_id,
            ReminderRule.is_active.is_(True),
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def create(
        self,
        household_id: int,
        user_id: int | None,
        charge_id: int | None,
        service_type_id: int | None,
        kind: str,
        days_before: int,
        channels: list[str],
        is_active: bool,
    ) -> ReminderRule:
        r = ReminderRule(
            household_id=household_id,
            user_id=user_id,
            charge_id=charge_id,
            service_type_id=service_type_id,
            kind=kind,
            days_before=days_before,
            channels=channels,
            is_active=is_active,
        )
        self.db.add(r)
        await self.db.flush()
        return r

    async def delete(self, rule: ReminderRule) -> None:
        await self.db.delete(rule)
        await self.db.flush()

    async def list_all_active(self) -> list[ReminderRule]:
        stmt = (
            select(ReminderRule)
            .where(ReminderRule.is_active.is_(True))
            .order_by(ReminderRule.household_id)
        )
        return list((await self.db.execute(stmt)).scalars().all())

class NotificationPreferenceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user_id: int) -> list[NotificationPreference]:
        stmt = (
            select(NotificationPreference)
            .where(NotificationPreference.user_id == user_id)
            .order_by(NotificationPreference.channel)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get(
        self, user_id: int, channel: str
    ) -> NotificationPreference | None:
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.channel == channel,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def upsert(
        self,
        user_id: int,
        channel: str,
        enabled: bool,
        quiet_hours_start,
        quiet_hours_end,
    ) -> NotificationPreference:
        pref = await self.get(user_id, channel)
        if pref is None:
            pref = NotificationPreference(
                user_id=user_id,
                channel=channel,
                enabled=enabled,
                quiet_hours_start=quiet_hours_start,
                quiet_hours_end=quiet_hours_end,
            )
            self.db.add(pref)
        else:
            pref.enabled = enabled
            pref.quiet_hours_start = quiet_hours_start
            pref.quiet_hours_end = quiet_hours_end
        await self.db.flush()
        return pref