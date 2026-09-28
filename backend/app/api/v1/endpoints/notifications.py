from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.notification import (
    DeviceRead,
    DeviceRegister,
    NotificationRead,
)
from app.schemas.reminder import (
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
)
from app.services.notification_service import (
    DeviceService,
    NotificationService,
)
from app.services.reminder_service import NotificationPreferenceService

router = APIRouter(prefix="/me", tags=["me"])


# ── Preferences ─────────────────────────────────────────────

@router.get(
    "/notification-preferences",
    response_model=list[NotificationPreferenceRead],
)
async def list_preferences(db: DbSession, current_user: CurrentUser):
    items = await NotificationPreferenceService(db).list_for_user(
        current_user.id
    )
    return [NotificationPreferenceRead.model_validate(p) for p in items]


@router.put(
    "/notification-preferences/{channel}",
    response_model=NotificationPreferenceRead,
)
async def upsert_preference(
    channel: str,
    data: NotificationPreferenceUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    pref = await NotificationPreferenceService(db).upsert(
        current_user.id, channel, data
    )
    return NotificationPreferenceRead.model_validate(pref)


# ── Devices ─────────────────────────────────────────────────

@router.get("/devices", response_model=list[DeviceRead])
async def list_devices(db: DbSession, current_user: CurrentUser):
    items = await DeviceService(db).list_for_user(current_user.id)
    return [DeviceRead.model_validate(d) for d in items]


@router.post(
    "/devices", response_model=DeviceRead, status_code=status.HTTP_201_CREATED
)
async def register_device(
    data: DeviceRegister, db: DbSession, current_user: CurrentUser
):
    d = await DeviceService(db).register(
        user_id=current_user.id,
        fcm_token=data.fcm_token,
        platform=data.platform,
        device_name=data.device_name,
    )
    return DeviceRead.model_validate(d)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int, db: DbSession, current_user: CurrentUser
):
    await DeviceService(db).delete(device_id, current_user.id)


# ── Notifications ───────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationRead])
async def list_notifications(
    db: DbSession,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    charge_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    items = await NotificationService(db).list_for_user(
        current_user.id,
        status=status_filter,
        charge_id=charge_id,
        limit=limit,
    )
    return [NotificationRead.model_validate(n) for n in items]