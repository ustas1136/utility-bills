from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.property import (
    PropertyCreate,
    PropertyRead,
    PropertyServiceCreate,
    PropertyServiceRead,
    PropertyServiceUpdate,
    PropertyUpdate,
)
from app.services.property_service import PropertyServiceService

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=list[PropertyRead])
async def list_properties(
    db: DbSession,
    current_user: CurrentUser,
    type: str | None = Query(None),
    include_archived: bool = Query(False),
):
    items = await PropertyServiceService(db).list_properties(
        current_user.id, type_=type, include_archived=include_archived
    )
    return [PropertyRead.model_validate(p) for p in items]


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
async def create_property(
    data: PropertyCreate, db: DbSession, current_user: CurrentUser
):
    prop = await PropertyServiceService(db).create_property(current_user.id, data)
    return PropertyRead.model_validate(prop)


@router.get("/{property_id}", response_model=PropertyRead)
async def get_property(
    property_id: int, db: DbSession, current_user: CurrentUser
):
    prop = await PropertyServiceService(db).get_property(
        property_id, current_user.id
    )
    return PropertyRead.model_validate(prop)


@router.patch("/{property_id}", response_model=PropertyRead)
async def update_property(
    property_id: int,
    data: PropertyUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    prop = await PropertyServiceService(db).update_property(
        property_id, current_user.id, data
    )
    return PropertyRead.model_validate(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_property(
    property_id: int, db: DbSession, current_user: CurrentUser
):
    await PropertyServiceService(db).archive_property(property_id, current_user.id)


@router.get(
    "/{property_id}/services", response_model=list[PropertyServiceRead]
)
async def list_services(
    property_id: int, db: DbSession, current_user: CurrentUser
):
    items = await PropertyServiceService(db).list_services(
        property_id, current_user.id
    )
    return [PropertyServiceRead.model_validate(s) for s in items]


@router.post(
    "/{property_id}/services",
    response_model=PropertyServiceRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_service(
    property_id: int,
    data: PropertyServiceCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    ps = await PropertyServiceService(db).add_service(
        property_id, current_user.id, data
    )
    return PropertyServiceRead.model_validate(ps)


@router.patch(
    "/{property_id}/services/{service_id}", response_model=PropertyServiceRead
)
async def update_service(
    property_id: int,
    service_id: int,
    data: PropertyServiceUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    ps = await PropertyServiceService(db).update_service(
        property_id, service_id, current_user.id, data
    )
    return PropertyServiceRead.model_validate(ps)


@router.delete(
    "/{property_id}/services/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_service(
    property_id: int,
    service_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    await PropertyServiceService(db).remove_service(
        property_id, service_id, current_user.id
    )