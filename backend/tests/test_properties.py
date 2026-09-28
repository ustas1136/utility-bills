import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"
PROPERTIES = "/api/v1/properties"
SERVICE_TYPES = "/api/v1/service-types"


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


async def _household_id(client: AsyncClient, token: str) -> int:
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    return r.json()[0]["id"]


async def _service_type_id(client: AsyncClient, token: str, code: str) -> int:
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    for st in r.json():
        if st["code"] == code:
            return st["id"]
    raise AssertionError(f"Service type '{code}' not found")


@pytest.mark.asyncio
async def test_create_apartment(client: AsyncClient) -> None:
    token = await _auth(client, "prop1@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={
            "household_id": hid,
            "type": "apartment",
            "name": "Квартира на Ленина",
            "address": "ул. Ленина, 1, кв. 42",
            "metadata_json": {"area": 62.5, "rooms": 2, "residents": 3},
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["type"] == "apartment"
    assert body["metadata_json"]["area"] == 62.5
    assert body["is_archived"] is False


@pytest.mark.asyncio
async def test_create_vehicle_with_vin(client: AsyncClient) -> None:
    token = await _auth(client, "prop2@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={
            "household_id": hid,
            "type": "vehicle",
            "name": "Toyota Camry",
            "metadata_json": {
                "make": "Toyota",
                "model": "Camry",
                "year": 2019,
                "vin": "JTNBE46K123456789",
                "plate": "А123ВС77",
            },
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["metadata_json"]["vin"] == "JTNBE46K123456789"


@pytest.mark.asyncio
async def test_invalid_property_type(client: AsyncClient) -> None:
    token = await _auth(client, "prop3@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={
            "household_id": hid,
            "type": "spaceship",  # не из enum
            "name": "X",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_properties_filter_by_type(client: AsyncClient) -> None:
    token = await _auth(client, "prop4@example.com")
    hid = await _household_id(client, token)

    await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "A"},
    )
    await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "vehicle", "name": "V"},
    )

    r = await client.get(f"{PROPERTIES}?type=vehicle", headers=_h(token))
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["type"] == "vehicle"


@pytest.mark.asyncio
async def test_archive_property(client: AsyncClient) -> None:
    token = await _auth(client, "prop5@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "To archive"},
    )
    pid = r.json()["id"]

    # По умолчанию в списке
    r = await client.get(PROPERTIES, headers=_h(token))
    assert any(p["id"] == pid for p in r.json())

    # Архивируем
    r = await client.delete(f"{PROPERTIES}/{pid}", headers=_h(token))
    assert r.status_code == 204

    # Не виден в списке
    r = await client.get(PROPERTIES, headers=_h(token))
    assert not any(p["id"] == pid for p in r.json())

    # Но виден с include_archived
    r = await client.get(
        f"{PROPERTIES}?include_archived=true", headers=_h(token)
    )
    assert any(p["id"] == pid for p in r.json())


@pytest.mark.asyncio
async def test_add_compatible_service(client: AsyncClient) -> None:
    token = await _auth(client, "prop6@example.com")
    hid = await _household_id(client, token)
    electricity_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "Flat"},
    )
    pid = r.json()["id"]

    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={
            "service_type_id": electricity_id,
            "account_number": "1234567890",
            "provider": "Мосэнергосбыт",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["service_type_id"] == electricity_id
    assert r.json()["is_active"] is True


@pytest.mark.asyncio
async def test_reject_incompatible_service(client: AsyncClient) -> None:
    """Квартире нельзя привязать транспортный налог."""
    token = await _auth(client, "prop7@example.com")
    hid = await _household_id(client, token)
    transport_tax_id = await _service_type_id(client, token, "transport_tax")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "Flat"},
    )
    pid = r.json()["id"]

    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": transport_tax_id},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cannot_add_duplicate_service(client: AsyncClient) -> None:
    token = await _auth(client, "prop8@example.com")
    hid = await _household_id(client, token)
    electricity_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "F"},
    )
    pid = r.json()["id"]

    await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": electricity_id},
    )
    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": electricity_id},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_cannot_see_foreign_property(client: AsyncClient) -> None:
    t1 = await _auth(client, "prop9@example.com")
    t2 = await _auth(client, "prop10@example.com")
    hid1 = await _household_id(client, t1)

    r = await client.post(
        PROPERTIES,
        headers=_h(t1),
        json={"household_id": hid1, "type": "apartment", "name": "T1"},
    )
    pid = r.json()["id"]

    r = await client.get(f"{PROPERTIES}/{pid}", headers=_h(t2))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cannot_create_property_in_foreign_household(
    client: AsyncClient,
) -> None:
    t1 = await _auth(client, "prop11@example.com")
    t2 = await _auth(client, "prop12@example.com")

    r = await client.post(HOUSEHOLDS, headers=_h(t1), json={"name": "T1"})
    foreign_hid = r.json()["id"]

    r = await client.post(
        PROPERTIES,
        headers=_h(t2),
        json={"household_id": foreign_hid, "type": "apartment", "name": "X"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_remove_service(client: AsyncClient) -> None:
    token = await _auth(client, "prop13@example.com")
    hid = await _household_id(client, token)
    electricity_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        PROPERTIES,
        headers=_h(token),
        json={"household_id": hid, "type": "apartment", "name": "F"},
    )
    pid = r.json()["id"]

    r = await client.post(
        f"{PROPERTIES}/{pid}/services",
        headers=_h(token),
        json={"service_type_id": electricity_id},
    )
    sid = r.json()["id"]

    r = await client.delete(
        f"{PROPERTIES}/{pid}/services/{sid}", headers=_h(token)
    )
    assert r.status_code == 204

    r = await client.get(f"{PROPERTIES}/{pid}/services", headers=_h(token))
    assert r.json() == []