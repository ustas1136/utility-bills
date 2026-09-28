import os
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # регистрирует модели в Base.metadata
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

settings = get_settings()

# Тестовая БД: отдельный URL из env, чтобы не стирать dev-данные.
# Если переменная не задана — используется DATABASE_URL.
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", str(settings.database_url))


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Сессия в транзакции — всё откатится после теста."""
    conn = await engine.connect()
    trans = await conn.begin()
    maker = async_sessionmaker(bind=conn, class_=AsyncSession, expire_on_commit=False)
    session = maker()
    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await conn.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()