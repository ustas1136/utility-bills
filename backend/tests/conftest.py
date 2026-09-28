import os
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # регистрирует модели в Base.metadata
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.service_type import ServiceType

settings = get_settings()
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", str(settings.database_url))


def _seed_system_service_types(connection) -> None:
    """Дубликат seed-миграции для тестовой БД."""
    data = [
        {"code": "electricity", "name": "Электроэнергия", "category": "utility",
         "unit": "kWh", "periodicity": "monthly", "metered": True,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "water_cold", "name": "Холодная вода", "category": "utility",
         "unit": "m3", "periodicity": "monthly", "metered": True,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "water_hot", "name": "Горячая вода", "category": "utility",
         "unit": "m3", "periodicity": "monthly", "metered": True,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "gas", "name": "Газ", "category": "utility",
         "unit": "m3", "periodicity": "monthly", "metered": True,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "heating", "name": "Отопление", "category": "utility",
         "unit": "Gcal", "periodicity": "monthly", "metered": False,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "waste", "name": "Вывоз мусора", "category": "utility",
         "unit": "person", "periodicity": "monthly", "metered": False,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "land_tax", "name": "Земельный налог", "category": "tax",
         "unit": None, "periodicity": "yearly", "metered": False,
         "applicable_object_types": ["land"], "is_system": True},
        {"code": "property_tax", "name": "Налог на имущество", "category": "tax",
         "unit": None, "periodicity": "yearly", "metered": False,
         "applicable_object_types": ["apartment", "house"], "is_system": True},
        {"code": "transport_tax", "name": "Транспортный налог", "category": "tax",
         "unit": None, "periodicity": "yearly", "metered": False,
         "applicable_object_types": ["vehicle"], "is_system": True},
        {"code": "osago", "name": "ОСАГО", "category": "insurance",
         "unit": None, "periodicity": "yearly", "metered": False,
         "applicable_object_types": ["vehicle"], "is_system": True},
        {"code": "kasko", "name": "КАСКО", "category": "insurance",
         "unit": None, "periodicity": "yearly", "metered": False,
         "applicable_object_types": ["vehicle"], "is_system": True},
    ]
    connection.execute(insert(ServiceType), data)


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_seed_system_service_types)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
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