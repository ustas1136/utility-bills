from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Device, Notification


class DeviceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, device_id: int) -> Device | None:
        return await self.db.get(Device, device_id)

    async def get_by_token(self, fcm_token: str) -> Device | None:
        stmt = select(Device).where(Device.fcm_token == fcm_token)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_for_user(self, user_id: int) -> list[Device]:
        stmt = (
            select(Device)
            .where(Device.user_id == user_id)
            .order_by(Device.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def register(
        self,
        user_id: int,
        fcm_token: str,
        platform: str,
        device_name: str | None,
    ) -> Device:
        existing = await self.get_by_token(fcm_token)
        if existing:
            # Токен переехал на другого пользователя или обновился
            existing.user_id = user_id
            existing.platform = platform
            existing.device_name = device_name
            existing.is_active = True
            await self.db.flush()
            return existing

        device = Device(
            user_id=user_id,
            fcm_token=fcm_token,
            platform=platform,
            device_name=device_name,
        )
        self.db.add(device)
        await self.db.flush()
        return device

    async def delete(self, device: Device) -> None:
        await self.db.delete(device)
        await self.db.flush()


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(
        self,
        user_id: int,
        status: str | None = None,
        charge_id: int | None = None,
        limit: int = 100,
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if status:
            stmt = stmt.where(Notification.status == status)
        if charge_id:
            stmt = stmt.where(Notification.charge_id == charge_id)
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_due_pending(
        self, now: datetime, limit: int = 500
    ) -> list[Notification]:
        """Уведомления, которые пора отправить (используется в блоке C)."""
        stmt = (
            select(Notification)
            .where(
                Notification.status == "pending",
                Notification.scheduled_at <= now,
            )
            .order_by(Notification.scheduled_at)
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def exists_dedup(
        self,
        user_id: int,
        charge_id: int | None,
        reminder_rule_id: int | None,
        channel: str,
        scheduled_date,
    ) -> bool:
        stmt = select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.charge_id.is_(charge_id)
            if charge_id is None
            else Notification.charge_id == charge_id,
            Notification.reminder_rule_id.is_(reminder_rule_id)
            if reminder_rule_id is None
            else Notification.reminder_rule_id == reminder_rule_id,
            Notification.channel == channel,
            Notification.scheduled_date == scheduled_date,
        )
        return (await self.db.execute(stmt)).first() is not None

    async def create(
        self,
        user_id: int,
        charge_id: int | None,
        reminder_rule_id: int | None,
        channel: str,
        title: str,
        body: str,
        scheduled_at: datetime,
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            charge_id=charge_id,
            reminder_rule_id=reminder_rule_id,
            channel=channel,
            title=title,
            body=body,
            scheduled_at=scheduled_at,
            scheduled_date=scheduled_at.date(),
        )
        self.db.add(n)
        await self.db.flush()
        return n