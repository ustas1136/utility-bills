import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.charge import Charge
from app.models.notification import Notification
from app.repositories.charge_repo import ChargeRepository
from app.repositories.household_repo import HouseholdRepository
from app.repositories.notification_repo import NotificationRepository
from app.repositories.reminder_repo import (
    NotificationPreferenceRepository,
    ReminderRuleRepository,
)
from app.repositories.user_repo import UserRepository
from app.services.notification_sender import get_sender

logger = logging.getLogger(__name__)

ACTIVE_CHARGE_STATUSES = ("pending", "partial", "overdue")


async def process_reminders() -> None:
    """Точка входа планировщика. Создаёт свою сессию БД."""
    async with SessionLocal() as db:
        try:
            created = await _create_due_notifications(db)
            await db.commit()
            sent = await _dispatch_pending(db)
            await db.commit()
            logger.info(
                "process_reminders done: created=%d sent=%d", created, sent
            )
        except Exception:
            await db.rollback()
            logger.exception("process_reminders failed")


async def _create_due_notifications(db: AsyncSession) -> int:
    """Находит правила, для которых пришло время, и создаёт pending-уведомления."""
    today = date.today()
    now = datetime.now(UTC)

    rules_repo = ReminderRuleRepository(db)
    notif_repo = NotificationRepository(db)
    charge_repo = ChargeRepository(db)
    pref_repo = NotificationPreferenceRepository(db)
    household_repo = HouseholdRepository(db)
    user_repo = UserRepository(db)

    active_rules = await rules_repo.list_all_active()
    created = 0

    for rule in active_rules:
        # Какие charge подпадают под правило?
        if rule.charge_id is not None:
            charge = await charge_repo.get_by_id(rule.charge_id)
            if not charge or charge.status not in ACTIVE_CHARGE_STATUSES:
                continue
            candidates = [charge]
        else:
            candidates = await charge_repo.list_unpaid_in_household(
                rule.household_id,
                due_before=today + timedelta(days=rule.days_before),
            )
            if rule.service_type_id is not None:
                candidates = [
                    c
                    for c in candidates
                    if c.property_service.service_type_id
                    == rule.service_type_id
                ]

        # Кому отправляем
        if rule.user_id is not None:
            user = await user_repo.get_by_id(rule.user_id)
            recipients = [user] if user and user.is_active else []
        else:
            members = await household_repo.list_members(rule.household_id)
            recipients = [m.user for m in members if m.role != "viewer"]

        for charge in candidates:
            target = charge.due_date - timedelta(days=rule.days_before)
            if today < target:
                continue

            title, body = _build_message(charge, rule.kind)

            for user in recipients:
                for channel in rule.channels:
                    pref = await pref_repo.get(user.id, channel)
                    if pref and not pref.enabled:
                        continue
                    if pref and _in_quiet_hours(pref, now):
                        continue
                    if await notif_repo.exists_for(
                        user.id, charge.id, rule.id, channel
                    ):
                        continue

                    await notif_repo.create(
                        user_id=user.id,
                        charge_id=charge.id,
                        reminder_rule_id=rule.id,
                        channel=channel,
                        title=title,
                        body=body,
                        scheduled_at=now,
                    )
                    created += 1

    return created


async def _dispatch_pending(db: AsyncSession) -> int:
    """Отправляет pending-уведомления, у которых наступило scheduled_at."""
    now = datetime.now(UTC)
    notif_repo = NotificationRepository(db)
    user_repo = UserRepository(db)

    pending: list[Notification] = await notif_repo.list_due_pending(now)
    sent = 0

    for n in pending:
        user = await user_repo.get_by_id(n.user_id)
        if not user or not user.is_active:
            n.status = "failed"
            n.error_message = "user not found or inactive"
            n.attempts += 1
            continue

        sender = get_sender(n.channel)
        try:
            await sender.send(user.email, n.title, n.body)
            n.status = "sent"
            n.sent_at = datetime.now(UTC)
            sent += 1
        except Exception as exc:
            n.status = "failed"
            n.error_message = str(exc)[:500]
            n.attempts += 1
            logger.exception("Failed to send notification id=%s", n.id)

    await db.flush()
    return sent


def _build_message(charge: Charge, kind: str) -> tuple[str, str]:
    st = charge.property_service.service_type
    amount = f"{charge.amount} {charge.currency}"

    if kind == "payment_due":
        title = f"Скоро оплата: {st.name}"
        body = (
            f"Напоминаем: {amount} за {st.name} "
            f"нужно оплатить до {charge.due_date}."
        )
    elif kind == "reading_due":
        title = f"Пора передать показания: {st.name}"
        body = (
            f"Передайте показания по услуге {st.name} "
            f"за период до {charge.period_end}."
        )
    else:
        title = f"Напоминание: {st.name}"
        body = f"Начисление {amount}, срок оплаты {charge.due_date}."

    return title, body


def _in_quiet_hours(pref, now: datetime) -> bool:
    if not pref.quiet_hours_start or not pref.quiet_hours_end:
        return False
    t = now.time()
    start = pref.quiet_hours_start
    end = pref.quiet_hours_end
    if start <= end:
        return start <= t <= end
    # Через полночь, например 22:00–08:00
    return t >= start or t <= end