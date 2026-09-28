from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.bff import (
    ChargesListResponse,
    HomeResponse,
    PropertiesResponse,
    PropertyDetail,
)
from app.services.bff_service import BFFService

router = APIRouter(prefix="/bff", tags=["bff"])

MODE_STATUS = r"^(pending|partial|paid|overdue|cancelled)$"


@router.get("/home", response_model=HomeResponse)
async def home(
    db: DbSession,
    current_user: CurrentUser,
    upcoming_days: int = Query(30, ge=1, le=365),
    notifications_limit: int = Query(5, ge=1, le=50),
):
    result = await BFFService(db).home(
        current_user.id,
        upcoming_days=upcoming_days,
        notifications_limit=notifications_limit,
    )
    return result.model_copy(update={"user_email": current_user.email})


@router.get("/properties", response_model=PropertiesResponse)
async def properties(db: DbSession, current_user: CurrentUser):
    return await BFFService(db).list_properties(current_user.id)


@router.get("/property/{property_id}", response_model=PropertyDetail)
async def property_detail(
    property_id: int, db: DbSession, current_user: CurrentUser
):
    return await BFFService(db).property_detail(property_id, current_user.id)


@router.get("/charges", response_model=ChargesListResponse)
async def charges(
    db: DbSession,
    current_user: CurrentUser,
    status: str | None = Query(None, pattern=MODE_STATUS),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await BFFService(db).list_charges(
        current_user.id, status=status, limit=limit, offset=offset
    )