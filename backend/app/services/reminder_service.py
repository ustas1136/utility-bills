from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_role
from app.models.reminder import NotificationPreference, ReminderRule
from app.repositories.household_repo import HouseholdRepository
from app.repositories.reminder_repo import (
    NotificationPreferenceRepository,
    ReminderRuleRepository,
)
from app.schemas.reminder import (
    NotificationPreferenceUpdate,
    ReminderRuleCreate,
    ReminderRuleUpdate,
)


class ReminderRuleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rules = ReminderRuleRepository(db)
        self.households = HouseholdRepository(db)

    async def _require_member(self, household_id: int, user_id: int):
        membership = await self.households.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=404, detail="Household not found"
            )
        return membership

    async def list_for_household(
        self, household_id: int, user_id: int
    ) -> list[ReminderRule]:
        await self._require_member(household_id, user_id)
        return await self.rules.list_for_household(household_id)

    async def create(
        self, household_id: int, user_id: int, data: ReminderRuleCreate
    ) -> ReminderRule:
        membership = await self._require_member(household_id, user_id)
        require_role(membership.role, "member")

        # Ровно один из charge_id / service_type_id / оба None (общее правило)
        if data.charge_id is not None and data.service_type_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Specify either charge_id or service_type_id, not both",
            )

        rule = await self.rules.create(
            household_id=household_id,
            user_id=data.user_id,
            charge_id=data.charge_id,
            service_type_id=data.service_type_id,
            kind=data.kind,
            days_before=data.days_before,
            channels=data.channels,
            is_active=data.is_active,
        )
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def update(
        self, rule_id: int, user_id: int, data: ReminderRuleUpdate
    ) -> ReminderRule:
        rule = await self.rules.get_by_id(rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        membership = await self._require_member(rule.household_id, user_id)
        require_role(membership.role, "member")

        if data.days_before is not None:
            rule.days_before = data.days_before
        if data.channels is not None:
            rule.channels = data.channels
        if data.is_active is not None:
            rule.is_active = data.is_active
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def delete(self, rule_id: int, user_id: int) -> None:
        rule = await self.rules.get_by_id(rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        membership = await self._require_member(rule.household_id, user_id)
        require_role(membership.role, "admin")
        await self.rules.delete(rule)
        await self.db.commit()


class NotificationPreferenceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.prefs = NotificationPreferenceRepository(db)

    async def list_for_user(self, user_id: int) -> list[NotificationPreference]:
        return await self.prefs.list_for_user(user_id)

    async def upsert(
        self,
        user_id: int,
        channel: str,
        data: NotificationPreferenceUpdate,
    ) -> NotificationPreference:
        current = await self.prefs.get(user_id, channel)
        enabled = (
            data.enabled
            if data.enabled is not None
            else (current.enabled if current else True)
        )
        qhs = (
            data.quiet_hours_start
            if data.quiet_hours_start is not None
            else (current.quiet_hours_start if current else None)
        )
        qhe = (
            data.quiet_hours_end
            if data.quiet_hours_end is not None
            else (current.quiet_hours_end if current else None)
        )
        pref = await self.prefs.upsert(
            user_id=user_id,
            channel=channel,
            enabled=enabled,
            quiet_hours_start=qhs,
            quiet_hours_end=qhe,
        )
        await self.db.commit()
        await self.db.refresh(pref)
        return pref