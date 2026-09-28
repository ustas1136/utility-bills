from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    charge_id: int | None
    reminder_rule_id: int | None
    channel: str
    title: str
    body: str
    status: str
    error_message: str | None
    attempts: int
    scheduled_at: datetime
    scheduled_date: date
    sent_at: datetime | None
    created_at: datetime


class DeviceRegister(BaseModel):
    fcm_token: str = Field(min_length=10, max_length=512)
    platform: str = Field(pattern=r"^(android|ios|web)$")
    device_name: str | None = Field(None, max_length=200)


class DeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    platform: str
    device_name: str | None
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime