from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.catalog import (
    ServiceTypeCreate,
    ServiceTypeRead,
    TariffCreate,
    TariffRead,
)
from app.services.catalog_service import CatalogService

router = APIRouter(tags=["catalog"])


@router.get("/service-types", response_model=list[ServiceTypeRead])
async def list_service_types(
    db: DbSession,
    current_user: CurrentUser,
    category: str | None = Query(None),
    object_type: str | None = Query(None),
):
    items = await CatalogService(db).list_service_types(
        current_user.id, category=category, object_type=object_type
    )
    return [ServiceTypeRead.model_validate(st) for st in items]


@router.post(
    "/service-types",
    response_model=ServiceTypeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_service_type(
    data: ServiceTypeCreate, db: DbSession, current_user: CurrentUser
):
    st = await CatalogService(db).create_service_type(current_user.id, data)
    return ServiceTypeRead.model_validate(st)


@router.delete(
    "/service-types/{st_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_service_type(
    st_id: int, db: DbSession, current_user: CurrentUser
):
    await CatalogService(db).delete_service_type(st_id, current_user.id)


@router.get("/tariffs", response_model=list[TariffRead])
async def list_tariffs(
    db: DbSession,
    current_user: CurrentUser,
    service_type_id: int | None = Query(None),
    on_date: date | None = Query(None),
):
    items = await CatalogService(db).list_tariffs(
        current_user.id, service_type_id=service_type_id, on_date=on_date
    )
    return [TariffRead.model_validate(t) for t in items]


@router.post(
    "/tariffs", response_model=TariffRead, status_code=status.HTTP_201_CREATED
)
async def create_tariff(
    data: TariffCreate, db: DbSession, current_user: CurrentUser
):
    t = await CatalogService(db).create_tariff(current_user.id, data)
    return TariffRead.model_validate(t)

@router.delete(
    "/tariffs/{tariff_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_tariff(
    tariff_id: int, db: DbSession, current_user: CurrentUser
):
    await CatalogService(db).delete_tariff(tariff_id, current_user.id)