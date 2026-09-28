import pytest
from httpx import AsyncClient

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


async def _household_id(client: AsyncClient, token: str) -> int:
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    return r.json()[0]["id"]


async def _service_type_id(client, token, code: str) -> int:
    r = await client.get(SERVICE_TYPES, headers=_h(token))
    for st in r.json():
        if st["code"] == code:
            return st["id"]
    raise AssertionError(f"{code} not found")


# ── Reminder rules ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_general_reminder_rule(client: AsyncClient) -> None:
    token = await _auth(client, "r1@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={
            "kind": "payment_due",
            "days_before": 3,
            "channels": ["email"],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["days_before"] == 3
    assert body["channels"] == ["email"]
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_create_rule_for_service_type(client: AsyncClient) -> None:
    token = await _auth(client, "r2@example.com")
    hid = await _household_id(client, token)
    st_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={
            "kind": "reading_due",
            "days_before": 5,
            "channels": ["email", "push"],
            "service_type_id": st_id,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["service_type_id"] == st_id


@pytest.mark.asyncio
async def test_cannot_set_both_charge_and_service_type(
    client: AsyncClient,
) -> None:
    token = await _auth(client, "r3@example.com")
    hid = await _household_id(client, token)
    st_id = await _service_type_id(client, token, "electricity")

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={
            "kind": "payment_due",
            "days_before": 3,
            "channels": ["email"],
            "charge_id": 1,
            "service_type_id": st_id,
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_rule(client: AsyncClient) -> None:
    token = await _auth(client, "r4@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )
    rid = r.json()["id"]

    r = await client.patch(
        f"/api/v1/reminder-rules/{rid}",
        headers=_h(token),
        json={"days_before": 7, "is_active": False},
    )
    assert r.status_code == 200
    assert r.json()["days_before"] == 7
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_delete_rule(client: AsyncClient) -> None:
    token = await _auth(client, "r5@example.com")
    hid = await _household_id(client, token)

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/reminder-rules",
        headers=_h(token),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )
    rid = r.json()["id"]

    r = await client.delete(
        f"/api/v1/reminder-rules/{rid}", headers=_h(token)
    )
    assert r.status_code == 204

    r = await client.get(
        f"{HOUSEHOLDS}/{hid}/reminder-rules", headers=_h(token)
    )
    assert r.json() == []


@pytest.mark.asyncio
async def test_cannot_see_foreign_rules(client: AsyncClient) -> None:
    t1 = await _auth(client, "r6@example.com")
    t2 = await _auth(client, "r7@example.com")
    hid1 = await _household_id(client, t1)

    await client.post(
        f"{HOUSEHOLDS}/{hid1}/reminder-rules",
        headers=_h(t1),
        json={"kind": "payment_due", "days_before": 3, "channels": ["email"]},
    )

    r = await client.get(
        f"{HOUSEHOLDS}/{hid1}/reminder-rules", headers=_h(t2)
    )
    assert r.status_code == 404


# ── Preferences ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_preference(client: AsyncClient) -> None:
    token = await _auth(client, "p1@example.com")

    r = await client.put(
        "/api/v1/me/notification-preferences/email",
        headers=_h(token),
        json={"enabled": False, "quiet_hours_start": "22:00:00",
              "quiet_hours_end": "08:00:00"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["channel"] == "email"
    assert body["enabled"] is False
    assert body["quiet_hours_start"] == "22:00:00"

    # Повторный upsert обновляет
    r = await client.put(
        "/api/v1/me/notification-preferences/email",
        headers=_h(token),
        json={"enabled": True},
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True


@pytest.mark.asyncio
async def test_list_preferences(client: AsyncClient) -> None:
    token = await _auth(client, "p2@example.com")

    await client.put(
        "/api/v1/me/notification-preferences/email",
        headers=_h(token),
        json={"enabled": True},
    )
    await client.put(
        "/api/v1/me/notification-preferences/push",
        headers=_h(token),
        json={"enabled": True},
    )

    r = await client.get(
        "/api/v1/me/notification-preferences", headers=_h(token)
    )
    assert r.status_code == 200
    channels = {p["channel"] for p in r.json()}
    assert channels == {"email", "push"}


# ── Devices ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_device(client: AsyncClient) -> None:
    token = await _auth(client, "d1@example.com")

    r = await client.post(
        "/api/v1/me/devices",
        headers=_h(token),
        json={
            "fcm_token": "test-fcm-token-12345",
            "platform": "android",
            "device_name": "Pixel",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["platform"] == "android"
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_reregister_device_updates(client: AsyncClient) -> None:
    token = await _auth(client, "d2@example.com")

    payload = {
        "fcm_token": "same-token-abc",
        "platform": "ios",
        "device_name": "iPhone",
    }
    r = await client.post("/api/v1/me/devices", headers=_h(token), json=payload)
    first_id = r.json()["id"]

    r = await client.post("/api/v1/me/devices", headers=_h(token), json=payload)
    assert r.status_code == 201
    assert r.json()["id"] == first_id


@pytest.mark.asyncio
async def test_delete_device(client: AsyncClient) -> None:
    token = await _auth(client, "d3@example.com")

    r = await client.post(
        "/api/v1/me/devices",
        headers=_h(token),
        json={"fcm_token": "to-delete-xyz", "platform": "web"},
    )
    did = r.json()["id"]

    r = await client.delete(f"/api/v1/me/devices/{did}", headers=_h(token))
    assert r.status_code == 204

    r = await client.get("/api/v1/me/devices", headers=_h(token))
    assert r.json() == []


# ── Notifications ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_notifications_empty(client: AsyncClient) -> None:
    token = await _auth(client, "n1@example.com")
    r = await client.get("/api/v1/me/notifications", headers=_h(token))
    assert r.status_code == 200
    assert r.json() == []