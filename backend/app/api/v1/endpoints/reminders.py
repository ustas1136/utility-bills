from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.reminder import (
    ReminderRuleCreate,
    ReminderRuleRead,
    ReminderRuleUpdate,
)
from app.services.reminder_service import ReminderRuleService

router = APIRouter(tags=["reminders"])


@router.get(
    "/households/{household_id}/reminder-rules",
    response_model=list[ReminderRuleRead],
)
async def list_rules(
    household_id: int, db: DbSession, current_user: CurrentUser
):
    items = await ReminderRuleService(db).list_for_household(
        household_id, current_user.id
    )
    return [ReminderRuleRead.model_validate(r) for r in items]


@router.post(
    "/households/{household_id}/reminder-rules",
    response_model=ReminderRuleRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    household_id: int,
    data: ReminderRuleCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    rule = await ReminderRuleService(db).create(
        household_id, current_user.id, data
    )
    return ReminderRuleRead.model_validate(rule)


@router.patch(
    "/reminder-rules/{rule_id}", response_model=ReminderRuleRead
)
async def update_rule(
    rule_id: int,
    data: ReminderRuleUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    rule = await ReminderRuleService(db).update(
        rule_id, current_user.id, data
    )
    return ReminderRuleRead.model_validate(rule)


@router.delete(
    "/reminder-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_rule(
    rule_id: int, db: DbSession, current_user: CurrentUser
):
    await ReminderRuleService(db).delete(rule_id, current_user.id)