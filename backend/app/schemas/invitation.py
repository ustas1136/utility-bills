from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(admin|member|viewer)$")


class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime