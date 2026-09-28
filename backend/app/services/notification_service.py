from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Device, Notification
from app.repositories.notification_repo import (
    DeviceRepository,
    NotificationRepository,
)


class DeviceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.devices = DeviceRepository(db)

    async def list_for_user(self, user_id: int) -> list[Device]:
        return await self.devices.list_for_user(user_id)

    async def register(
        self,
        user_id: int,
        fcm_token: str,
        platform: str,
        device_name: str | None,
    ) -> Device:
        device = await self.devices.register(
            user_id=user_id,
            fcm_token=fcm_token,
            platform=platform,
            device_name=device_name,
        )
        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def delete(self, device_id: int, user_id: int) -> None:
        device = await self.devices.get_by_id(device_id)
        if not device or device.user_id != user_id:
            raise HTTPException(status_code=404, detail="Device not found")
        await self.devices.delete(device)
        await self.db.commit()


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notifications = NotificationRepository(db)

    async def list_for_user(
        self,
        user_id: int,
        status: str | None = None,
        charge_id: int | None = None,
        limit: int = 100,
    ) -> list[Notification]:
        return await self.notifications.list_for_user(
            user_id, status=status, charge_id=charge_id, limit=limit
        )