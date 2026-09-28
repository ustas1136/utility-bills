import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
HOUSEHOLDS = "/api/v1/households"


async def _auth(client: AsyncClient, email: str) -> str:
    await client.post(
        REGISTER,
        json={"email": email, "password": "strong-password-123"},
    )
    r = await client.post(
        LOGIN, json={"email": email, "password": "strong-password-123"}
    )
    return r.json()["access_token"]


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_personal_household_created_on_register(client: AsyncClient) -> None:
    token = await _auth(client, "p1@example.com")
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["is_personal"] is True
    assert items[0]["role"] == "owner"


@pytest.mark.asyncio
async def test_create_household(client: AsyncClient) -> None:
    token = await _auth(client, "p2@example.com")
    r = await client.post(
        HOUSEHOLDS,
        headers=_h(token),
        json={"name": "Family", "base_currency": "RUB"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Family"
    assert body["role"] == "owner"
    assert body["is_personal"] is False


@pytest.mark.asyncio
async def test_cannot_see_other_household(client: AsyncClient) -> None:
    t1 = await _auth(client, "a@example.com")
    t2 = await _auth(client, "b@example.com")

    r = await client.post(HOUSEHOLDS, headers=_h(t1), json={"name": "A's home"})
    household_id = r.json()["id"]

    r = await client.get(f"{HOUSEHOLDS}/{household_id}", headers=_h(t2))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_household_by_owner(client: AsyncClient) -> None:
    token = await _auth(client, "own@example.com")
    r = await client.post(HOUSEHOLDS, headers=_h(token), json={"name": "Old"})
    hid = r.json()["id"]

    r = await client.patch(
        f"{HOUSEHOLDS}/{hid}", headers=_h(token), json={"name": "New"}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New"


@pytest.mark.asyncio
async def test_cannot_delete_personal_household(client: AsyncClient) -> None:
    token = await _auth(client, "p3@example.com")
    r = await client.get(HOUSEHOLDS, headers=_h(token))
    hid = r.json()[0]["id"]

    r = await client.delete(f"{HOUSEHOLDS}/{hid}", headers=_h(token))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_list_members(client: AsyncClient) -> None:
    token = await _auth(client, "mem@example.com")
    r = await client.post(HOUSEHOLDS, headers=_h(token), json={"name": "M"})
    hid = r.json()["id"]

    r = await client.get(f"{HOUSEHOLDS}/{hid}/members", headers=_h(token))
    assert r.status_code == 200
    members = r.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"


@pytest.mark.asyncio
async def test_create_invitation(client: AsyncClient) -> None:
    owner_token = await _auth(client, "owner@example.com")
    r = await client.post(
        HOUSEHOLDS, headers=_h(owner_token), json={"name": "Shared"}
    )
    hid = r.json()["id"]

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/invitations",
        headers=_h(owner_token),
        json={"email": "guest@example.com", "role": "member"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "guest@example.com"
    assert body["role"] == "member"
    assert body["accepted_at"] is None


@pytest.mark.asyncio
async def test_cannot_invite_owner_role(client: AsyncClient) -> None:
    token = await _auth(client, "inv@example.com")
    r = await client.post(HOUSEHOLDS, headers=_h(token), json={"name": "X"})
    hid = r.json()["id"]

    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/invitations",
        headers=_h(token),
        json={"email": "x@example.com", "role": "owner"},
    )
    # Pydantic pattern ^(admin|member|viewer)$ отклонит owner
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cannot_invite_existing_member(client: AsyncClient) -> None:
    owner_token = await _auth(client, "own2@example.com")
    r = await client.post(HOUSEHOLDS, headers=_h(owner_token), json={"name": "Y"})
    hid = r.json()["id"]

    # Владелец уже участник — попробуем пригласить себя
    r = await client.post(
        f"{HOUSEHOLDS}/{hid}/invitations",
        headers=_h(owner_token),
        json={"email": "own2@example.com", "role": "member"},
    )
    assert r.status_code == 409