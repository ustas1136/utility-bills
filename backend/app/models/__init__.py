"""SQLAlchemy models. Импорт всех моделей нужен для Alembic autogenerate."""

from app.models.charge import Charge, Payment
from app.models.household import Household, HouseholdMember, Invitation
from app.models.meter import Meter, Reading
from app.models.property import Property, PropertyService
from app.models.service_type import ServiceType
from app.models.tariff import Tariff
from app.models.user import User

__all__ = [
    "Charge",
    "Household",
    "HouseholdMember",
    "Invitation",
    "Meter",
    "Payment",
    "Property",
    "PropertyService",
    "Reading",
    "ServiceType",
    "Tariff",
    "User",
]