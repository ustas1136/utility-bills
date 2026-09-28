from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

REMINDER_KIND = r"^(payment_due|reading_due|custom)$"
CHANNEL = r"^(email|push|telegram)$"


class ReminderRuleBase(BaseModel):
    user_id: int | None = None
    charge_id: int | None = None
    service_type_id: int | None = None
    kind: str = Field(pattern=REMINDER_KIND)
    days_before: int = Field(ge=0, le=365)
    channels: list[str] = Field(min_length=1)
    is_active: bool = True


class ReminderRuleCreate(ReminderRuleBase):
    household_id: int


class ReminderRuleUpdate(BaseModel):
    days_before: int | None = Field(None, ge=0, le=365)
    channels: list[str] | None = Field(None, min_length=1)
    is_active: bool | None = None


class ReminderRuleRead(ReminderRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    created_at: datetime


class NotificationPreferenceBase(BaseModel):
    channel: str = Field(pattern=CHANNEL)
    enabled: bool = True
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None


class NotificationPreferenceUpdate(BaseModel):
    enabled: bool | None = None
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None


class NotificationPreferenceRead(NotificationPreferenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    updated_at: datetime