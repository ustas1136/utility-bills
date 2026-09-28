from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.workers.tasks.send_reminders import _create_due_notifications

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"
PROPERTIES = "/api/v1/properties"
SERVICE_TYPES = "/api/v1/service-types"
CHARGES = "/api/v1/charges"


async def _auth(client: AsyncClient, email: str) -> str:
    await client.post(
        REGISTER, json={"email": email, "password": "strong-password-123"}
    )
    r = await client.post(
        LOGIN, json={"email": email, "password": "strong-password-123"}
    )
    return r.json()["access_token"]


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _service_type_id(client, token, code: str) -> int:
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    for st in r.json():
        if st["code"] == code:
            return st["id"]
    raise AssertionError(f"{code} not found")


async def _setup_charge(
    client: AsyncClient, token: str, due_in_days: int
) -> tuple[int, int, int]:
    """Возвращает (household_id, property_service_id, charge_id)."""
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    hid = r.json()[0]["id"]
    st_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "Flat"},
    )
    pid = r.json()["id"]

    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": st_id},
    )
    ps_id = r.json()["id"]

    due = date.today() + timedelta(days=due_in_days)
    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": str(date.today() - timedelta(days=30)),
            "period_end": str(date.today()),
            "amount": "500.00",
            "currency": "RUB",
            "due_date": str(due),
        },
    )
    cid = r.json()["id"]
    return hid, ps_id, cid


@pytest.mark.asyncio
async def test_scheduler_creates_notification_when_due(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _auth(client, "sch1@example.com")
    hid, _, _ = await _setup_charge(client, token, due_in_days=2)

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )
    assert r.status_code == 201

    created = await _create_due_notifications(db_session)
    assert created == 1

    result = await db_session.execute(select(Notification))
    notifs = list(result.scalars().all())
    assert len(notifs) == 1
    assert notifs[0].channel == "email"
    assert notifs[0].status == "pending"


@pytest.mark.asyncio
async def test_scheduler_skips_charge_far_from_due(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _auth(client, "sch2@example.com")
    hid, _, _ = await _setup_charge(client, token, due_in_days=30)

    await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )

    created = await _create_due_notifications(db_session)
    assert created == 0


@pytest.mark.asyncio
async def test_scheduler_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _auth(client, "sch3@example.com")
    hid, _, _ = await _setup_charge(client, token, due_in_days=1)

    await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )

    first = await _create_due_notifications(db_session)
    second = await _create_due_notifications(db_session)
    assert first == 1
    assert second == 0


@pytest.mark.asyncio
async def test_scheduler_filters_by_service_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Правило для electricity не срабатывает для water_cold."""
    token = await _auth(client, "sch4@example.com")
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    hid = r.json()[0]["id"]

    # Квартира
    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "Flat"},
    )
    pid = r.json()["id"]

    # Две услуги
    water_id = await _service_type_id(client, token, "water_cold")
    electricity_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": water_id},
    )
    water_ps_id = r.json()["id"]

    # Charge по воде с близким due_date
    due = date.today() + timedelta(days=2)
    await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": water_ps_id,
            "period_start": str(date.today() - timedelta(days=30)),
            "period_end": str(date.today()),
            "amount": "300.00",
            "due_date": str(due),
        },
    )

    # Правило только для electricity
    await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={
            "kind": "payment_due",
            "days_before": 3,
            "channels": ["email"],
            "service_type_id": electricity_id,
        },
    )

    created = await _create_due_notifications(db_session)
    assert created == 0


@pytest.mark.asyncio
async def test_scheduler_skips_disabled_channel(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _auth(client, "sch5@example.com")
    hid, _, _ = await _setup_charge(client, token, due_in_days=1)

    # Отключаем email
    await client.put(
        "/api/v1/me/notification-preferences/email",
        headers=_h(token),
        json={"enabled": False},
    )

    await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )

    created = await _create_due_notifications(db_session)
    assert created == 0