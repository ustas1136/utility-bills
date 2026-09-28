from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

PROPERTY_TYPE = r"^(apartment|house|land|vehicle|other)$"


class PropertyBase(BaseModel):
    type: str = Field(pattern=PROPERTY_TYPE)
    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(None, max_length=500)
    metadata_json: dict = Field(default_factory=dict)


class PropertyCreate(PropertyBase):
    household_id: int


class PropertyUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    address: str | None = Field(None, max_length=500)
    metadata_json: dict | None = None
    is_archived: bool | None = None


class PropertyRead(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    is_archived: bool
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class PropertyServiceBase(BaseModel):
    service_type_id: int
    account_number: str | None = Field(None, max_length=64)
    provider: str | None = Field(None, max_length=200)
    started_at: date | None = None
    closed_at: date | None = None


class PropertyServiceCreate(PropertyServiceBase):
    pass


class PropertyServiceUpdate(BaseModel):
    account_number: str | None = Field(None, max_length=64)
    provider: str | None = Field(None, max_length=200)
    is_active: bool | None = None
    started_at: date | None = None
    closed_at: date | None = None


class PropertyServiceRead(PropertyServiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property_id: int
    is_active: bool
    created_at: datetime