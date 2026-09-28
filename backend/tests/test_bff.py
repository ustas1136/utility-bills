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
BFF = "/api/v1/bff"


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
    client: AsyncClient,
    token: str,
    due_in_days: int = 5,
    amount: str = "500.00",
    paid: bool = False,
) -> tuple[int, int, int]:
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
        await client.post(
            f"{CHARGES}/{cid}/payments",
            headers=_h(token),
            json={
                "amount": amount,
                "paid_at": f"{date.today().isoformat()}T10:00:00Z",
                "method": "card",
            },
        )
    return hid, pid, cid


@pytest.mark.asyncio
async def test_home_empty(client: AsyncClient) -> None:
    token = await _auth(client, "bff1@example.com")
    r = await client.get(f"{BFF}/home", headers=_h(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["household_count"] == 1
    assert body["upcoming"] == []
    assert body["totals"] == []
    assert body["user_email"] == "bff1@example.com"


@pytest.mark.asyncio
async def test_home_with_upcoming_charge(client: AsyncClient) -> None:
    token = await _auth(client, "bff2@example.com")
    _, _, cid = await _setup_charge(client, token, due_in_days=3, amount="500.00")

    r = await client.get(f"{BFF}/home?upcoming_days=30", headers=_h(token))
    assert r.status_code == 200
    body = r.json()
    assert len(body["upcoming"]) == 1
    assert body["upcoming"][0]["charge_id"] == cid
    assert body["upcoming"][0]["days_left"] == 3
    assert Decimal(body["upcoming"][0]["amount"]) == Decimal("500.00")

    assert len(body["totals"]) == 1
    assert body["totals"][0]["currency"] == "RUB"
    assert Decimal(body["totals"][0]["pending_amount"]) == Decimal("500.00")
    assert Decimal(body["totals"][0]["overdue_amount"]) == Decimal("0")


@pytest.mark.asyncio
async def test_home_excludes_paid_charges(client: AsyncClient) -> None:
    token = await _auth(client, "bff3@example.com")
    await _setup_charge(client, token, paid=True)

    r = await client.get(f"{BFF}/home", headers=_h(token))
    assert r.status_code == 200
    assert r.json()["upcoming"] == []
    assert r.json()["totals"] == []


@pytest.mark.asyncio
async def test_home_overdue_charge(client: AsyncClient) -> None:
    token = await _auth(client, "bff4@example.com")
    await _setup_charge(client, token, due_in_days=-5, amount="300.00")

    r = await client.get(f"{BFF}/home", headers=_h(token))
    body = r.json()
    assert len(body["totals"]) == 1
    assert Decimal(body["totals"][0]["overdue_amount"]) == Decimal("300.00")


@pytest.mark.asyncio
async def test_properties_list(client: AsyncClient) -> None:
    token = await _auth(client, "bff5@example.com")
    await _setup_charge(client, token, due_in_days=5, amount="250.00")

    r = await client.get(f"{BFF}/properties", headers=_h(token))
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["type"] == "apartment"
    assert items[0]["service_count"] == 1
    assert Decimal(items[0]["pending_amount"]) == Decimal("250.00")


@pytest.mark.asyncio
async def test_property_detail(client: AsyncClient) -> None:
    token = await _auth(client, "bff6@example.com")
    _, pid, _ = await _setup_charge(client, token)

    r = await client.get(f"{BFF}/property/{pid}", headers=_h(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["property_id"] == pid
    assert len(body["services"]) == 1
    assert body["services"][0]["service_type_code"] == "electricity"
    assert body["services"][0]["meter_count"] == 0
    assert body["services"][0]["last_reading_value"] is None


@pytest.mark.asyncio
async def test_property_detail_not_found(client: AsyncClient) -> None:
    token = await _auth(client, "bff7@example.com")
    r = await client.get(f"{BFF}/property/99999", headers=_h(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_charges_list_with_filter(client: AsyncClient) -> None:
    token = await _auth(client, "bff8@example.com")
    await _setup_charge(client, token, due_in_days=5, amount="100.00")
    await _setup_charge(client, token, due_in_days=10, amount="200.00", paid=True)

    r = await client.get(f"{BFF}/charges?status=pending", headers=_h(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert Decimal(body["items"][0]["amount"]) == Decimal("100.00")

    r = await client.get(f"{BFF}/charges", headers=_h(token))
    body = r.json()
    assert body["total"] == 2