
from fastapi import APIRouter, status
from sqlalchemy import text

from app.api.deps import DbSession

router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health() -> dict[str, str]:
    """Базовая проверка живости приложения."""
    return {"status": "ok"}


@router.get("/health/db", status_code=status.HTTP_200_OK)
async def health_db(db: DbSession) -> dict[str, str]:
    """Проверка подключения к БД."""
    result = await db.execute(text("SELECT 1"))
    result.scalar_one()
    return {"status": "ok", "database": "reachable"}