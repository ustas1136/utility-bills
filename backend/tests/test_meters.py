from decimal import Decimal

import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"
PROPERTIES = "/api/v1/properties"
SERVICE_TYPES = "/api/v1/service-types"
METERS = "/api/v1/meters"


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


async def _apartment_with_service(
    client: AsyncClient, token: str, service_code: str = "electricity"
) -> tuple[int, int]:
    """Возвращает (property_id, property_service_id)."""
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    hid = r.json()[0]["id"]

    st_id = await _service_type_id(client, token, service_code)

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
    return pid, ps_id


@pytest.mark.asyncio
async def test_create_meter(client: AsyncClient) -> None:
    token = await _auth(client, "m1@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "serial_number": "ABC-123",
            "initial_value": "100.000",
            "unit": "kWh",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["serial_number"] == "ABC-123"
    assert Decimal(body["initial_value"]) == Decimal("100.000")
    assert body["replaced_at"] is None


@pytest.mark.asyncio
async def test_cannot_create_meter_for_non_metered_service(
    client: AsyncClient,
) -> None:
    token = await _auth(client, "m2@example.com")
    # heating — metered=False
    _, ps_id = await _apartment_with_service(client, token, "heating")

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "0",
            "unit": "Gcal",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cannot_create_second_active_meter(client: AsyncClient) -> None:
    token = await _auth(client, "m3@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    payload = {
        "property_service_id": ps_id,
        "initial_value": "0",
        "unit": "kWh",
    }
    r = await client.post(METERS, headers=_h(token), json=payload)
    assert r.status_code == 201

    r = await client.post(METERS, headers=_h(token), json=payload)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_add_reading_ok(client: AsyncClient) -> None:
    token = await _auth(client, "m4@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    r = await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "150", "taken_at": "2026-09-01"},
    )
    assert r.status_code == 201, r.text
    assert Decimal(r.json()["value"]) == Decimal("150")


@pytest.mark.asyncio
async def test_reading_must_be_monotonic(client: AsyncClient) -> None:
    token = await _auth(client, "m5@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "150", "taken_at": "2026-09-01"},
    )

    r = await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "120", "taken_at": "2026-10-01"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_reading_below_initial_rejected(client: AsyncClient) -> None:
    token = await _auth(client, "m6@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    r = await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "50", "taken_at": "2026-09-01"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_force_override(client: AsyncClient) -> None:
    token = await _auth(client, "m7@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "initial_value": "100",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    r = await client.post(
        f"{METERS}/{mid}/readings",
        headers=_h(token),
        json={"value": "50", "taken_at": "2026-09-01", "force": True},
    )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_duplicate_date_rejected(client: AsyncClient) -> None:
    token = await _auth(client, "m8@example.com")
    _, ps_id = await _apartment_with_service(client, token)

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

    payload = {"value": "10", "taken_at": "2026-09-01"}
    await client.post(f"{METERS}/{mid}/readings", headers=_h(token), json=payload)
    r = await client.post(
        f"{METERS}/{mid}/readings", headers=_h(token), json=payload
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_replace_meter(client: AsyncClient) -> None:
    token = await _auth(client, "m9@example.com")
    _, ps_id = await _apartment_with_service(client, token)

    r = await client.post(
        METERS,
        headers=_h(token),
        json={
            "property_service_id": ps_id,
            "serial_number": "OLD-001",
            "initial_value": "0",
            "unit": "kWh",
        },
    )
    old_id = r.json()["id"]

    r = await client.post(
        f"{METERS}/{old_id}/replace",
        headers=_h(token),
        json={
            "replaced_at": "2026-10-01",
            "serial_number": "NEW-001",
            "initial_value": "5000",
        },
    )
    assert r.status_code == 200, r.text
    new = r.json()
    assert new["serial_number"] == "NEW-001"
    assert new["id"] != old_id

    # Старый помечен replaced
    r = await client.get(f"{METERS}/{old_id}", headers=_h(token))
    old = r.json()
    assert old["replaced_at"] == "2026-10-01"
    assert old["replaced_by_meter_id"] == new["id"]

    # Старый счётчик больше нельзя заменить
    r = await client.post(
        f"{METERS}/{old_id}/replace",
        headers=_h(token),
        json={"replaced_at": "2026-11-01", "initial_value": "0"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_reading_history_filtered_by_date(client: AsyncClient) -> None:
    token = await _auth(client, "m10@example.com")
    _, ps_id = await _apartment_with_service(client, token)

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

    for d, v in [("2026-07-01", 10), ("2026-08-01", 20), ("2026-09-01", 30)]:
        await client.post(
            f"{METERS}/{mid}/readings",
            headers=_h(token),
            json={"value": str(v), "taken_at": d},
        )

    r = await client.get(
        f"{METERS}/{mid}/readings?date_from=2026-08-01&date_to=2026-08-31",
        headers=_h(token),
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["taken_at"] == "2026-08-01"


@pytest.mark.asyncio
async def test_cannot_access_foreign_meter(client: AsyncClient) -> None:
    t1 = await _auth(client, "m11@example.com")
    t2 = await _auth(client, "m12@example.com")

    _, ps_id = await _apartment_with_service(client, t1)
    r = await client.post(
        METERS,
        headers=_h(t1),
        json={
            "property_service_id": ps_id,
            "initial_value": "0",
            "unit": "kWh",
        },
    )
    mid = r.json()["id"]

    r = await client.get(f"{METERS}/{mid}", headers=_h(t2))
    assert r.status_code == 404