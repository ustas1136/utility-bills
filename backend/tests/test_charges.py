from decimal import Decimal

import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"
PROPERTIES = "/api/v1/properties"
SERVICE_TYPES = "/api/v1/service-types"
METERS = "/api/v1/meters"
CHARGES = "/api/v1/charges"
TARIFFS = "/api/v1/tariffs"


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


async def _setup_electricity(
    client: AsyncClient, token: str
) -> tuple[int, int, int]:
    """Возвращает (household_id, property_id, property_service_id)."""
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
    return hid, pid, ps_id


async def _create_tariff(
    client: AsyncClient, token: str, household_id: int, rate: str = "5.0000"
) -> None:
    st_id = await _service_type_id(client, token, "electricity")
    r = await client.post(
        TARIFFS,
        headers=_h(token),
        json={
            "service_type_id": st_id,
            "household_id": household_id,
            "rate": rate,
            "valid_from": "2020-01-01",
        },
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_create_manual_charge(client: AsyncClient) -> None:
    token = await _auth(client, "c1@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "500.00",
            "currency": "RUB",
            "due_date": "2026-10-15",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["source"] == "manual"


@pytest.mark.asyncio
async def test_calculate_charge_from_readings(client: AsyncClient) -> None:
    token = await _auth(client, "c2@example.com")
    hid, _, ps_id = await _setup_electricity(client, token)
    await _create_tariff(client, token, hid, rate="5.0000")

    # Счётчик и показания
    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100.000",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    # Показание до периода (baseline)
    await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "150.000", "taken_at": "2026-08-25"},
    )
    # Показание в периоде
    await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "200.000", "taken_at": "2026-09-25"},
    )

    r = await client.post(
        f"{CHARGES}/calculate",
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "due_date": "2026-10-15",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    # consumption = 200 - 150 = 50, rate = 5 → amount = 250.00
    assert Decimal(body["amount"]) == Decimal("250.00")
    assert body["source"] == "calculated"


@pytest.mark.asyncio
async def test_calculate_without_tariff_fails(client: AsyncClient) -> None:
    token = await _auth(client, "c3@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "0",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]
    await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "10", "taken_at": "2026-09-15"},
    )

    r = await client.post(
        f"{CHARGES}/calculate",
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "due_date": "2026-10-15",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_partial_payment_updates_status(client: AsyncClient) -> None:
    token = await _auth(client, "c4@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "1000.00",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    # Частичная оплата 400
    r = await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "400.00",
            "paid_at": "2026-09-20T10:00:00Z",
            "method": "card",
        },
    )
    assert r.status_code == 201, r.text

    r = await client.get(f"{CHARGES}/{cid}", headers=_h(token))
    assert r.json()["status"] == "partial"
    assert Decimal(r.json()["paid_amount"]) == Decimal("400.00")

    # Вторая оплата 600 — теперь paid
    await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "600.00",
            "paid_at": "2026-09-25T10:00:00Z",
            "method": "card",
        },
    )
    r = await client.get(f"{CHARGES}/{cid}", headers=_h(token))
    assert r.json()["status"] == "paid"


@pytest.mark.asyncio
async def test_overpayment_marks_paid(client: AsyncClient) -> None:
    token = await _auth(client, "c5@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "100.00",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "150.00",
            "paid_at": "2026-09-20T10:00:00Z",
            "method": "card",
        },
    )
    r = await client.get(f"{CHARGES}/{cid}", headers=_h(token))
    assert r.json()["status"] == "paid"


@pytest.mark.asyncio
async def test_delete_payment_recalc_status(client: AsyncClient) -> None:
    token = await _auth(client, "c6@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "500.00",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    r = await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "500.00",
            "paid_at": "2026-09-20T10:00:00Z",
            "method": "card",
        },
    )
    pid = r.json()["id"]

    r = await client.get(f"{CHARGES}/{cid}", headers=_h(token))
    assert r.json()["status"] == "paid"

    r = await client.delete(
        f"{CHARGES}/{cid}/payments/{pid}", headers=_h(token)
    )
    assert r.status_code == 204

    r = await client.get(f"{CHARGES}/{cid}", headers=_h(token))
    assert r.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_currency_mismatch_rejected(client: AsyncClient) -> None:
    token = await _auth(client, "c7@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "500.00",
            "currency": "RUB",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    r = await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "100.00",
            "currency": "USD",
            "paid_at": "2026-09-20T10:00:00Z",
            "method": "card",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cancel_charge(client: AsyncClient) -> None:
    token = await _auth(client, "c8@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    r = await client.post(
        CHARGES,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "500.00",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    r = await client.post(f"{CHARGES}/{cid}/cancel", headers=_h(token))
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    # Нельзя оплатить отменённое
    r = await client.post(
        f"{CHARGES}/{cid}/payments",
        headers=_h(token),
        json={
            "amount": "100.00",
            "paid_at": "2026-09-20T10:00:00Z",
            "method": "card",
        },
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cannot_see_foreign_charge(client: AsyncClient) -> None:
    t1 = await _auth(client, "c9@example.com")
    t2 = await _auth(client, "c10@example.com")

    _, _, ps_id = await _setup_electricity(client, t1)
    r = await client.post(
        CHARGES,
        headers=_h(t1),
        json={
            "property_service_id": ps_id,
            "period_start": "2026-09-01",
            "period_end": "2026-09-30",
            "amount": "100.00",
            "due_date": "2026-12-31",
        },
    )
    cid = r.json()["id"]

    r = await client.get(f"{CHARGES}/{cid}", headers=_h(t2))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_charges_with_filter(client: AsyncClient) -> None:
    token = await _auth(client, "c11@example.com")
    _, _, ps_id = await _setup_electricity(client, token)

    for amount, due in [("100", "2026-10-15"), ("200", "2026-11-15")]:
        await client.post(
            CHARGES,
            headers=_h(token),
            json={
                "property_service_id": ps_id,
                "period_start": "2026-09-01",
                "period_end": "2026-09-30",
                "amount": amount,
                "due_date": due,
            },
        )

    r = await client.get(
        f"{CHARGES}?property_service_id={ps_id}&status=pending",
        headers=_h(token),
    )
    assert r.status_code == 200
    assert len(r.json()) == 2