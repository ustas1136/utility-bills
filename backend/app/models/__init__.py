"""SQLAlchemy models. Импорт всех моделей нужен для Alembic autogenerate."""

from app.models.household import Household, HouseholdMember, Invitation
from app.models.property import Property, PropertyService
from app.models.service_type import ServiceType
from app.models.tariff import Tariff
from app.models.user import User

__all__ = [
    "Household",
    "HouseholdMember",
    "Invitation",
    "Property",
    "PropertyService",
    "ServiceType",
    "Tariff",
    "User",
]