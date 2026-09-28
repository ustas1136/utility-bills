import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
SERVICE_TYPES = "/api/v1/service-types"
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


@pytest.mark.asyncio
async def test_list_system_service_types(client: AsyncClient) -> None:
    token = await _auth(client, "cat1@example.com")
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    assert r.status_code == 200
    items = r.json()
    codes = {st["code"] for st in items}
    # Все системные услуги из seed-миграции должны быть доступны
    assert {"electricity", "water_cold", "osago", "transport_tax"} <= codes
    # Все они помечены is_system
    for st in items:
        if st["code"] in {"electricity", "osago"}:
            assert st["is_system"] is True


@pytest.mark.asyncio
async def test_filter_by_category(client: AsyncClient) -> None:
    token = await _auth(client, "cat2@example.com")
    r = await client.get(f"{SERVICE_TYPES}?category=tax", headers=_h(token))
    assert r.status_code == 200
    items = r.json()
    assert all(st["category"] == "tax" for st in items)


@pytest.mark.asyncio
async def test_create_custom_service_type(client: AsyncClient) -> None:
    token = await _auth(client, "cat3@example.com")
    payload = {
        "code": "internet",
        "name": "Домашний интернет",
        "category": "utility",
        "unit": None,
        "periodicity": "monthly",
        "metered": False,
        "applicable_object_types": ["apartment", "house"],
    }
    r = await client.post(SERVICE_TYPES, headers=_h(token), json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["code"] == "internet"
    assert body["is_system"] is False
    assert body["created_by"] is not None


@pytest.mark.asyncio
async def test_duplicate_code_rejected(client: AsyncClient) -> None:
    token = await _auth(client, "cat4@example.com")
    payload = {
        "code": "electricity",  # системный код уже существует
        "name": "Мой электрический",
        "category": "utility",
        "periodicity": "monthly",
    }
    r = await client.post(SERVICE_TYPES, headers=_h(token), json=payload)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_cannot_delete_system_service_type(client: AsyncClient) -> None:
    token = await _auth(client, "cat5@example.com")
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    electricity = next(st for st in r.json() if st["code"] == "electricity")

    r = await client.delete(
        f"{SERVICE_TYPES}/{electricity['id']}", headers=_h(token)
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cannot_see_others_custom_service_type(
    client: AsyncClient,
) -> None:
    t1 = await _auth(client, "cat6@example.com")
    t2 = await _auth(client, "cat7@example.com")

    # Пользователь 1 создаёт свой тип
    r = await client.post(
        SERVICE_TYPES,
        headers=_h(t1),
        json={
            "code": "user1_custom",
            "name": "Мой личный",
            "category": "other",
            "periodicity": "one_time",
        },
    )
    assert r.status_code == 201

    # Пользователь 2 не должен видеть его
    r = await client.get(SERVICE_TYPES, headers=_h(t2))
    codes = {st["code"] for st in r.json()}
    assert "user1_custom" not in codes


@pytest.mark.asyncio
async def test_create_tariff_for_household(client: AsyncClient) -> None:
    token = await _auth(client, "tar1@example.com")

    # Получаем личный household
    r = await client.get("/api/v1/households", headers=_h(token))
    hid = r.json()[0]["id"]

    # Получаем id electricity
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    electricity_id = next(
        st["id"] for st in r.json() if st["code"] == "electricity"
    )

    r = await client.post(
        TARIFFS,
        headers=_h(token),
        json={
            "service_type_id": electricity_id,
            "household_id": hid,
            "rate": "5.4500",
            "currency": "RUB",
            "valid_from": "2026-01-01",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["service_type_id"] == electricity_id
    assert r.json()["household_id"] == hid


@pytest.mark.asyncio
async def test_list_tariffs_filtered(client: AsyncClient) -> None:
    token = await _auth(client, "tar2@example.com")
    r = await client.get("/api/v1/households", headers=_h(token))
    hid = r.json()[0]["id"]

    r = await client.get(SERVICE_TYPES, headers=_h(token))
    electricity_id = next(
        st["id"] for st in r.json() if st["code"] == "electricity"
    )
    water_id = next(st["id"] for st in r.json() if st["code"] == "water_cold")

    # Создаём два тарифа
    for st_id, rate in [(electricity_id, "5.45"), (water_id, "30.00")]:
        await client.post(
            TARIFFS,
            headers=_h(token),
            json={
                "service_type_id": st_id,
                "household_id": hid,
                "rate": rate,
                "valid_from": "2026-01-01",
            },
        )

    # Фильтр по service_type_id
    r = await client.get(
        f"{TARIFFS}?service_type_id={electricity_id}", headers=_h(token)
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["service_type_id"] == electricity_id


@pytest.mark.asyncio
async def test_cannot_create_tariff_for_foreign_household(
    client: AsyncClient,
) -> None:
    t1 = await _auth(client, "tar3@example.com")
    t2 = await _auth(client, "tar4@example.com")

    # Пользователь 1 создаёт household
    r = await client.post(
        "/api/v1/households", headers=_h(t1), json={"name": "T1"}
    )
    foreign_hid = r.json()["id"]

    # Пользователь 2 получает electricity
    r = await client.get(SERVICE_TYPES, headers=_h(t2))
    electricity_id = next(
        st["id"] for st in r.json() if st["code"] == "electricity"
    )

    # Пытается создать тариф в чужой household
    r = await client.post(
        TARIFFS,
        headers=_h(t2),
        json={
            "service_type_id": electricity_id,
            "household_id": foreign_hid,
            "rate": "5.45",
            "valid_from": "2026-01-01",
        },
    )
    assert r.status_code == 403