from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"
PROPERTIES = "/api/v1/properties"
SERVICE_TYPES = "/api/v1/service-types"
CHARGES = "/api/v1/charges"
REPORTS = "/api/v1/reports"


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


async def _setup_charge_with_payment(
    client: AsyncClient,
    token: str,
    due_in_days: int = 10,
    amount: str = "500.00",
    paid: bool = True,
) -> tuple[int, int]:
    """Создаёт property, service, charge и (опц.) платёж.

    Возвращает (property_id, charge_id).
    """
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
            "amount": amount,
            "currency": "RUB",
            "due_date": str(due),
        },
    )
    cid = r.json()["id"]

    if paid:
        r = await client.post(
            f"{CHARGES}/{cid}/payments",
            headers=_h(token),
            json={
                "amount": amount,
                "paid_at": f"{date.today().isoformat()}T10:00:00Z",
                "method": "card",
            },
        )
        assert r.status_code == 201, r.text

    return pid, cid


@pytest.mark.asyncio
async def test_expenses_empty(client: AsyncClient) -> None:
    token = await _auth(client, "rep1@example.com")
    r = await client.get(f"{REPORTS}/expenses", headers=_h(token))
    assert r.status_code == 200
    assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_expenses_paid(client: AsyncClient) -> None:
    token = await _auth(client, "rep2@example.com")
    await _setup_charge_with_payment(client, token, amount="500.00")

    r = await client.get(f"{REPORTS}/expenses", headers=_h(token))
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["category"] == "utility"
    assert Decimal(items[0]["amount"]) == Decimal("500.00")


@pytest.mark.asyncio
async def test_expenses_accrued(client: AsyncClient) -> None:
    token = await _auth(client, "rep3@example.com")
    await _setup_charge_with_payment(
        client, token, amount="700.00", paid=False
    )

    r = await client.get(
        f"{REPORTS}/expenses?mode=accrued", headers=_h(token)
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert Decimal(items[0]["amount"]) == Decimal("700.00")


@pytest.mark.asyncio
async def test_by_property(client: AsyncClient) -> None:
    token = await _auth(client, "rep4@example.com")
    pid, _ = await _setup_charge_with_payment(client, token, amount="300.00")

    r = await client.get(f"{REPORTS}/by-property", headers=_h(token))
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["property_id"] == pid
    assert Decimal(items[0]["amount"]) == Decimal("300.00")


@pytest.mark.asyncio
async def test_upcoming(client: AsyncClient) -> None:
    token = await _auth(client, "rep5@example.com")
    _, cid = await _setup_charge_with_payment(
        client, token, due_in_days=5, amount="400.00", paid=False
    )

    r = await client.get(f"{REPORTS}/upcoming?days=30", headers=_h(token))
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["charge_id"] == cid
    assert items[0]["days_left"] == 5
    assert items[0]["status"] == "pending"


@pytest.mark.asyncio
async def test_upcoming_excludes_paid(client: AsyncClient) -> None:
    token = await _auth(client, "rep6@example.com")
    await _setup_charge_with_payment(client, token, paid=True)

    r = await client.get(f"{REPORTS}/upcoming", headers=_h(token))
    assert r.status_code == 200
    assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_consumption(client: AsyncClient) -> None:
    token = await _auth(client, "rep7@example.com")

    # Создаём property + service + meter + 2 показания
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    hid = r.json()[0]["id"]
    st_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "F"},
    )
    pid = r.json()["id"]
    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": st_id},
    )
    ps_id = r.json()["id"]

    r = await client.post(
        "/api/v1/meters",
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100.000",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    today = date.today()
    for d, v in [
        (today - timedelta(days=60), "150.000"),
        (today - timedelta(days=30), "200.000"),
        (today, "250.000"),
    ]:
        await client.post(
            f"/api/v1/meters/{mid}/readings",
            headers=_h(token),
            json={"value": v, "taken_at": d.isoformat()},
        )

    r = await client.get(
        f"{REPORTS}/consumption"
        f"?from_date={today - timedelta(days=90)}"
        f"&to_date={today}",
        headers=_h(token),
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["service_type_code"] == "electricity"
    # 150 -> 200 -> 250 = 100
    assert Decimal(items[0]["total_consumption"]) == Decimal("100.000")


@pytest.mark.asyncio
async def test_export_csv(client: AsyncClient) -> None:
    token = await _auth(client, "rep8@example.com")
    await _setup_charge_with_payment(client, token, amount="250.00")

    r = await client.get(f"{REPORTS}/export.csv", headers=_h(token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    body = r.text
    assert "month,category,amount,currency" in body
    assert "utility" in body
    assert "250.00" in body