from fastapi import APIRouter

from app.api.v1.endpoints import auth, catalog, health, households, properties

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(households.router)
api_router.include_router(catalog.router)
api_router.include_router(properties.router)