from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_role
from app.models.charge import Charge, Payment
from app.models.household import HouseholdMember
from app.models.property import PropertyService
from app.repositories.charge_repo import ChargeRepository
from app.repositories.household_repo import HouseholdRepository
from app.repositories.meter_repo import MeterRepository
from app.repositories.payment_repo import PaymentRepository
from app.repositories.property_repo import PropertyRepository
from app.repositories.tariff_repo import TariffRepository
from app.schemas.charge import (
    ChargeCalculateRequest,
    ChargeCreate,
    ChargeUpdate,
    PaymentCreate,
)


class ChargeService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.charges = ChargeRepository(db)
        self.payments = PaymentRepository(db)
        self.properties = PropertyRepository(db)
        self.households = HouseholdRepository(db)
        self.meters = MeterRepository(db)
        self.tariffs = TariffRepository(db)

    # ── helpers ─────────────────────────────────────────────────

    async def _get_property_service_with_access(
        self, property_service_id: int, user_id: int
    ) -> tuple[PropertyService, HouseholdMember]:
        ps = await self.db.get(PropertyService, property_service_id)
        if not ps:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        prop = await self.properties.get_by_id(ps.property_id)
        if not prop:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        membership = await self.households.get_membership(
            prop.household_id, user_id
        )
        if not membership:
            raise HTTPException(
                status_code=404, detail="Property service not found"
            )
        return ps, membership

    async def _recalc_charge_status(self, charge: Charge) -> None:
        """Пересчитывает статус начисления на основе суммы платежей."""
        if charge.status == "cancelled":
            return

        paid = await self.charges.paid_amount(charge.id)
        if paid == 0:
            new_status = "pending"
        elif paid < charge.amount:
            new_status = "partial"
        else:
            new_status = "paid"

        # Если дата оплаты прошла, а начисление не закрыто — overdue
        if new_status != "paid" and charge.due_date < date.today():
            new_status = "overdue"

        charge.status = new_status
        await self.db.flush()

    # ── Charges ─────────────────────────────────────────────────

    async def list_charges(
        self,
        user_id: int,
        property_service_id: int | None = None,
        status_filter: str | None = None,
        due_before: date | None = None,
    ) -> list[Charge]:
        if property_service_id is not None:
            await self._get_property_service_with_access(
                property_service_id, user_id
            )
            return await self.charges.list_for_property_service(
                property_service_id, status=status_filter
            )

        rows = await self.households.list_for_user(user_id)
        household_ids = [h.id for h, _ in rows]
        if not household_ids:
            return []
        # Все property_services всех household пользователя
        ps_ids: list[int] = []
        for h_id in household_ids:
            props = await self.properties.list_for_households(
                [h_id], include_archived=True
            )
            for p in props:
                for s in p.services:
                    ps_ids.append(s.id)
        return await self.charges.list_for_household_services(
            ps_ids, status=status_filter, due_before=due_before
        )

    async def get_charge(self, charge_id: int, user_id: int) -> Charge:
        c = await self.charges.get_by_id(charge_id)
        if not c:
            raise HTTPException(status_code=404, detail="Charge not found")
        await self._get_property_service_with_access(
            c.property_service_id, user_id
        )
        return c

    async def create_charge(
        self, user_id: int, data: ChargeCreate
    ) -> Charge:
        _, membership = await self._get_property_service_with_access(
            data.property_service_id, user_id
        )
        require_role(membership.role, "member")

        if data.period_end < data.period_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="period_end must be >= period_start",
            )

        c = await self.charges.create(
            property_service_id=data.property_service_id,
            period_start=data.period_start,
            period_end=data.period_end,
            amount=data.amount,
            currency=data.currency,
            due_date=data.due_date,
            source="manual",
            notes=data.notes,
            created_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def calculate_charge(
        self, user_id: int, data: ChargeCalculateRequest
    ) -> Charge:
        ps, membership = await self._get_property_service_with_access(
            data.property_service_id, user_id
        )
        require_role(membership.role, "member")

        if not ps.service_type.metered:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Auto-calculation only supports metered services",
            )

        if data.period_end < data.period_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="period_end must be >= period_start",
            )

        # Активный счётчик
        meter = await self.meters.get_active_for_service(ps.id)
        if not meter:
            raise HTTPException(
                status_code=404,
                detail="No active meter for this service",
            )

        # Последнее показание <= period_end
        readings = await self.meters.list_readings(
            meter.id, date_from=None, date_to=data.period_end
        )
        current = readings[0] if readings else None
        if not current:
            raise HTTPException(
                status_code=422,
                detail=f"No readings found up to {data.period_end}",
            )

        # Предыдущее показание до period_start
        prev = await self.meters.get_previous_reading(
            meter.id, data.period_start
        )
        baseline = prev.value if prev else meter.initial_value
        consumption = current.value - baseline
        if consumption < 0:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Negative consumption: current={current.value}, "
                    f"previous={baseline}"
                ),
            )

        # Тариф на дату period_end
        prop = await self.properties.get_by_id(ps.property_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

        tariffs = await self.tariffs.list_visible(
            [prop.household_id],
            service_type_id=ps.service_type_id,
            on_date=data.period_end,
        )
        if not tariffs:
            raise HTTPException(
                status_code=422,
                detail=f"No tariff for service on {data.period_end}",
            )
        tariff = tariffs[0]

        amount = (consumption * tariff.rate).quantize(Decimal("0.01"))

        c = await self.charges.create(
            property_service_id=ps.id,
            period_start=data.period_start,
            period_end=data.period_end,
            amount=amount,
            currency=tariff.currency,
            due_date=data.due_date,
            source="calculated",
            notes=data.notes,
            created_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def update_charge(
        self, charge_id: int, user_id: int, data: ChargeUpdate
    ) -> Charge:
        c = await self.get_charge(charge_id, user_id)
        if c.status == "cancelled":
            raise HTTPException(
                status_code=400, detail="Cannot edit cancelled charge"
            )
        if data.amount is not None:
            c.amount = data.amount
        if data.due_date is not None:
            c.due_date = data.due_date
        if data.notes is not None:
            c.notes = data.notes
        await self._recalc_charge_status(c)
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def cancel_charge(self, charge_id: int, user_id: int) -> Charge:
        c = await self.get_charge(charge_id, user_id)
        if c.status == "paid":
            raise HTTPException(
                status_code=400, detail="Cannot cancel paid charge"
            )
        c.status = "cancelled"
        await self.db.commit()
        await self.db.refresh(c)
        return c

    # ── Payments ────────────────────────────────────────────────

    async def list_payments(
        self, charge_id: int, user_id: int
    ) -> list[Payment]:
        await self.get_charge(charge_id, user_id)
        return await self.payments.list_for_charge(charge_id)

    async def add_payment(
        self, charge_id: int, user_id: int, data: PaymentCreate
    ) -> Payment:
        c = await self.get_charge(charge_id, user_id)
        if c.status == "cancelled":
            raise HTTPException(
                status_code=400, detail="Cannot pay cancelled charge"
            )
        if data.currency != c.currency:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Payment currency {data.currency} doesn't match "
                    f"charge currency {c.currency}"
                ),
            )

        p = await self.payments.create(
            charge_id=charge_id,
            amount=data.amount,
            currency=data.currency,
            paid_at=data.paid_at,
            method=data.method,
            external_id=data.external_id,
            comment=data.comment,
            created_by=user_id,
        )
        await self.db.flush()
        await self._recalc_charge_status(c)
        await self.db.commit()
        await self.db.refresh(p)
        return p

    async def delete_payment(
        self, charge_id: int, payment_id: int, user_id: int
    ) -> None:
        c = await self.get_charge(charge_id, user_id)
        p = await self.payments.get_by_id(payment_id)
        if not p or p.charge_id != c.id:
            raise HTTPException(status_code=404, detail="Payment not found")
        await self.db.delete(p)
        await self.db.flush()
        await self._recalc_charge_status(c)
        await self.db.commit()