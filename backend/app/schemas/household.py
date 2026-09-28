from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HouseholdBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    base_currency: str = Field(default="RUB", min_length=3, max_length=3)


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    base_currency: str | None = Field(None, min_length=3, max_length=3)


class HouseholdRead(HouseholdBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    is_personal: bool
    created_at: datetime
    role: str | None = None  # роль текущего пользователя


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role: str
    joined_at: datetime


class MemberUpdate(BaseModel):
    role: str = Field(pattern="^(owner|admin|member|viewer)$")