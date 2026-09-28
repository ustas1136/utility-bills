import pytest
from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
ME = "/api/v1/auth/me"


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient) -> None:
    payload = {
        "email": "test@example.com",
        "password": "strong-password-123",
        "full_name": "Test User",
    }
    r = await client.post(REGISTER, json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "test@example.com"
    assert body["full_name"] == "Test User"
    assert "password" not in body
    assert "password_hash" not in body

    r = await client.post(
        LOGIN,
        json={"email": "test@example.com", "password": "strong-password-123"},
    )
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    payload = {"email": "dup@example.com", "password": "strong-password-123"}
    r1 = await client.post(REGISTER, json=payload)
    assert r1.status_code == 201
    r2 = await client.post(REGISTER, json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post(
        REGISTER,
        json={"email": "u@example.com", "password": "correct-password"},
    )
    r = await client.post(
        LOGIN,
        json={"email": "u@example.com", "password": "wrong-password"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient) -> None:
    r = await client.post(
        LOGIN,
        json={"email": "ghost@example.com", "password": "whatever-123"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_token(client: AsyncClient) -> None:
    r = await client.get(ME)
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_with_token(client: AsyncClient) -> None:
    await client.post(
        REGISTER,
        json={"email": "me@example.com", "password": "strong-password-123"},
    )
    r = await client.post(
        LOGIN,
        json={"email": "me@example.com", "password": "strong-password-123"},
    )
    access = r.json()["access_token"]

    r = await client.get(ME, headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["email"] == "me@example.com"


@pytest.mark.asyncio
async def test_refresh_flow(client: AsyncClient) -> None:
    await client.post(
        REGISTER,
        json={"email": "r@example.com", "password": "strong-password-123"},
    )
    r = await client.post(
        LOGIN,
        json={"email": "r@example.com", "password": "strong-password-123"},
    )
    refresh = r.json()["refresh_token"]

    r = await client.post(REFRESH, json={"refresh_token": refresh})
    assert r.status_code == 200
    assert r.json()["access_token"]
    assert r.json()["refresh_token"]


@pytest.mark.asyncio
async def test_refresh_rejects_access_token(client: AsyncClient) -> None:
    await client.post(
        REGISTER,
        json={"email": "x@example.com", "password": "strong-password-123"},
    )
    r = await client.post(
        LOGIN,
        json={"email": "x@example.com", "password": "strong-password-123"},
    )
    access = r.json()["access_token"]

    # Передаём access-токен в /refresh — должен быть отвергнут (type mismatch)
    r = await client.post(REFRESH, json={"refresh_token": access})
    assert r.status_code == 401