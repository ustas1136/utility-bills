from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.meter import (
    MeterCreate,
    MeterRead,
    MeterReplace,
    MeterUpdate,
    ReadingCreate,
    ReadingRead,
)
from app.services.meter_service import MeterService

router = APIRouter(tags=["meters"])


@router.post("/meters", response_model=MeterRead, status_code=status.HTTP_201_CREATED)
async def create_meter(
    data: MeterCreate, db: DbSession, current_user: CurrentUser
):
    m = await MeterService(db).create_meter(current_user.id, data)
    return MeterRead.model_validate(m)


@router.get(
    "/property-services/{ps_id}/meters", response_model=list[MeterRead]
)
async def list_meters_for_service(
    ps_id: int, db: DbSession, current_user: CurrentUser
):
    items = await MeterService(db).list_meters(ps_id, current_user.id)
    return [MeterRead.model_validate(m) for m in items]


@router.get("/meters/{meter_id}", response_model=MeterRead)
async def get_meter(
    meter_id: int, db: DbSession, current_user: CurrentUser
):
    m = await MeterService(db).get_meter(meter_id, current_user.id)
    return MeterRead.model_validate(m)


@router.patch("/meters/{meter_id}", response_model=MeterRead)
async def update_meter(
    meter_id: int,
    data: MeterUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    m = await MeterService(db).update_meter(meter_id, current_user.id, data)
    return MeterRead.model_validate(m)


@router.post("/meters/{meter_id}/replace", response_model=MeterRead)
async def replace_meter(
    meter_id: int,
    data: MeterReplace,
    db: DbSession,
    current_user: CurrentUser,
):
    m = await MeterService(db).replace_meter(meter_id, current_user.id, data)
    return MeterRead.model_validate(m)


@router.get("/meters/{meter_id}/readings", response_model=list[ReadingRead])
async def list_readings(
    meter_id: int,
    db: DbSession,
    current_user: CurrentUser,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    items = await MeterService(db).list_readings(
        meter_id, current_user.id, date_from=date_from, date_to=date_to
    )
    return [ReadingRead.model_validate(r) for r in items]


@router.post(
    "/meters/{meter_id}/readings",
    response_model=ReadingRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_reading(
    meter_id: int,
    data: ReadingCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    r = await MeterService(db).add_reading(meter_id, current_user.id, data)
    return ReadingRead.model_validate(r)


@router.delete(
    "/meters/{meter_id}/readings/{reading_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_reading(
    meter_id: int,
    reading_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    await MeterService(db).delete_reading(
        meter_id, reading_id, current_user.id
    )