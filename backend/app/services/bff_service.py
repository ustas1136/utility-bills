from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.charge import Charge, Payment
from app.models.meter import Meter, Reading
from app.models.notification import Notification
from app.models.property import Property, PropertyService
from app.repositories.household_repo import HouseholdRepository
from app.schemas.bff import (
    ChargeListItem,
    ChargesListResponse,
    HomeChargeItem,
    HomeNotificationItem,
    HomeResponse,
    HomeTotals,
    PropertiesResponse,
    PropertyDetail,
    PropertyListItem,
    PropertyServiceItem,
)


class BFFService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.households = HouseholdRepository(db)

    async def _household_ids(self, user_id: int) -> list[int]:
        rows = await self.households.list_for_user(user_id)
        return [h.id for h, _ in rows]

    # ── Home ────────────────────────────────────────────────────

    async def home(
        self, user_id: int, upcoming_days: int = 30, notifications_limit: int = 5
    ) -> HomeResponse:
        hh = await self._household_ids(user_id)

        # Blizhajshie neoplachennye charges
        upcoming: list[HomeChargeItem] = []
        totals_map: dict[str, dict[str, Decimal]] = {}

        if hh:
            horizon = date.today() + timedelta(days=upcoming_days)
            charge_rows = (
                await self.db.execute(
                    select(Charge, Property, PropertyService)
                    .join(
                        PropertyService,
                        Charge.property_service_id == PropertyService.id,
                    )
                    .join(
                        Property, PropertyService.property_id == Property.id
                    )
                    .options(
                        joinedload(Charge.property_service).joinedload(
                            PropertyService.service_type
                        )
                    )
                    .where(
                        Property.household_id.in_(hh),
                        Charge.status.in_(
                            ("pending", "partial", "overdue")
                        ),
                        Charge.due_date <= horizon,
                    )
                    .order_by(Charge.due_date)
                    .limit(20)
                )
            ).unique().all()

            for charge, prop, ps in charge_rows:
                paid = await self._paid_amount(charge.id)
                upcoming.append(
                    HomeChargeItem(
                        charge_id=charge.id,
                        property_name=prop.name,
                        service_name=ps.service_type.name,
                        amount=Decimal(charge.amount),
                        paid_amount=paid,
                        currency=charge.currency,
                        due_date=charge.due_date,
                        days_left=(charge.due_date - date.today()).days,
                        status=charge.status,
                    )
                )

            # Total dolg po valjutam
            totals_rows = (
                await self.db.execute(
                    select(Charge, Property)
                    .join(
                        PropertyService,
                        Charge.property_service_id == PropertyService.id,
                    )
                    .join(
                        Property, PropertyService.property_id == Property.id
                    )
                    .where(
                        Property.household_id.in_(hh),
                        Charge.status.in_(("pending", "partial", "overdue")),
                    )
                )
            ).all()

            for charge, _ in totals_rows:
                paid = await self._paid_amount(charge.id)
                remaining = Decimal(charge.amount) - paid
                if remaining <= 0:
                    continue
                entry = totals_map.setdefault(
                    charge.currency,
                    {"pending": Decimal("0"), "overdue": Decimal("0")},
                )
                if charge.due_date < date.today():
                    entry["overdue"] += remaining
                else:
                    entry["pending"] += remaining

        totals = [
            HomeTotals(
                currency=cur,
                pending_amount=v["pending"],
                overdue_amount=v["overdue"],
            )
            for cur, v in totals_map.items()
        ]

        # Poslednie notifications
        unread_notifs: list[HomeNotificationItem] = []
        notif_rows = (
            await self.db.execute(
                select(Notification)
                .where(Notification.user_id == user_id)
                .order_by(Notification.created_at.desc())
                .limit(notifications_limit)
            )
        ).scalars().all()
        for n in notif_rows:
            unread_notifs.append(
                HomeNotificationItem(
                    id=n.id,
                    channel=n.channel,
                    title=n.title,
                    body=n.body,
                    status=n.status,
                    created_at=n.created_at,
                )
            )

        return HomeResponse(
            user_email="",
            household_count=len(hh),
            upcoming=upcoming,
            unread_notifications=unread_notifs,
            totals=totals,
        )

    async def _paid_amount(self, charge_id: int) -> Decimal:
        stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.charge_id == charge_id
        )
        return Decimal((await self.db.execute(stmt)).scalar_one())

    # ── Properties ─────────────────────────────────────────────

    async def list_properties(self, user_id: int) -> PropertiesResponse:
        hh = await self._household_ids(user_id)
        if not hh:
            return PropertiesResponse(items=[])

        props = (
            await self.db.execute(
                select(Property)
                .where(
                    Property.household_id.in_(hh),
                    Property.is_archived.is_(False),
                )
                .options(
                    selectinload(Property.services).joinedload(
                        PropertyService.service_type
                    )
                )
                .order_by(Property.created_at)
            )
        ).scalars().all()

        items: list[PropertyListItem] = []
        for prop in props:
            pending = Decimal("0")
            currency = "RUB"

            for ps in prop.services:
                # Сумма начислений со статусом «не оплачено»
                charges_sum = (
                    await self.db.execute(
                        select(
                            func.coalesce(func.sum(Charge.amount), 0)
                        ).where(
                            Charge.property_service_id == ps.id,
                            Charge.status.in_(
                                ("pending", "partial", "overdue")
                            ),
                        )
                    )
                ).scalar_one()

                # Сумма платежей по этим же charge
                payments_sum = (
                    await self.db.execute(
                        select(
                            func.coalesce(func.sum(Payment.amount), 0)
                        )
                        .join(Charge, Payment.charge_id == Charge.id)
                        .where(
                            Charge.property_service_id == ps.id,
                            Charge.status.in_(
                                ("pending", "partial", "overdue")
                            ),
                        )
                    )
                ).scalar_one()

                pending += Decimal(charges_sum) - Decimal(payments_sum)

            items.append(
                PropertyListItem(
                    property_id=prop.id,
                    household_id=prop.household_id,
                    type=prop.type,
                    name=prop.name,
                    address=prop.address,
                    is_archived=prop.is_archived,
                    service_count=len(prop.services),
                    pending_amount=pending,
                    currency=currency,
                )
            )
        return PropertiesResponse(items=items)

    async def property_detail(
        self, property_id: int, user_id: int
    ) -> PropertyDetail:
        hh = await self._household_ids(user_id)
        prop = (
            await self.db.execute(
                select(Property)
                .where(
                    Property.id == property_id,
                    Property.household_id.in_(hh),
                )
                .options(
                    selectinload(Property.services).joinedload(
                        PropertyService.service_type
                    )
                )
            )
        ).scalar_one_or_none()
        if not prop:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Property not found")

        services: list[PropertyServiceItem] = []
        for ps in prop.services:
            meters = (
                await self.db.execute(
                    select(Meter).where(Meter.property_service_id == ps.id)
                )
            ).scalars().all()

            last_value: Decimal | None = None
            last_date = None
            if meters:
                m_ids = [m.id for m in meters]
                last = (
                    await self.db.execute(
                        select(Reading)
                        .where(Reading.meter_id.in_(m_ids))
                        .order_by(Reading.taken_at.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
                if last:
                    last_value = Decimal(last.value)
                    last_date = last.taken_at

            services.append(
                PropertyServiceItem(
                    property_service_id=ps.id,
                    service_type_code=ps.service_type.code,
                    service_type_name=ps.service_type.name,
                    is_active=ps.is_active,
                    meter_count=len(meters),
                    last_reading_value=last_value,
                    last_reading_date=last_date,
                )
            )

        return PropertyDetail(
            property_id=prop.id,
            household_id=prop.household_id,
            type=prop.type,
            name=prop.name,
            address=prop.address,
            metadata_json=prop.metadata_json,
            is_archived=prop.is_archived,
            services=services,
        )

    # ── Charges ────────────────────────────────────────────────

    async def list_charges(
        self,
        user_id: int,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> ChargesListResponse:
        hh = await self._household_ids(user_id)
        if not hh:
            return ChargesListResponse(items=[], total=0)

        stmt = (
            select(Charge, Property, PropertyService)
            .join(
                PropertyService,
                Charge.property_service_id == PropertyService.id,
            )
            .join(Property, PropertyService.property_id == Property.id)
            .options(
                joinedload(Charge.property_service).joinedload(
                    PropertyService.service_type
                )
            )
            .where(Property.household_id.in_(hh))
        )
        if status:
            stmt = stmt.where(Charge.status == status)
        stmt = stmt.order_by(Charge.due_date.desc(), Charge.id.desc())

        total = (
            await self.db.execute(
                select(func.count()).select_from(stmt.subquery())
            )
        ).scalar_one()

        rows = (
            await self.db.execute(stmt.limit(limit).offset(offset))
        ).unique().all()

        items: list[ChargeListItem] = []
        for charge, prop, ps in rows:
            paid = await self._paid_amount(charge.id)
            items.append(
                ChargeListItem(
                    charge_id=charge.id,
                    property_id=prop.id,
                    property_name=prop.name,
                    service_name=ps.service_type.name,
                    amount=Decimal(charge.amount),
                    paid_amount=paid,
                    currency=charge.currency,
                    period_start=charge.period_start,
                    period_end=charge.period_end,
                    due_date=charge.due_date,
                    status=charge.status,
                )
            )

        return ChargesListResponse(items=items, total=total)