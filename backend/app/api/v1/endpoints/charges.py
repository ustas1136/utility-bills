from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.charge import (
    ChargeCalculateRequest,
    ChargeCreate,
    ChargeRead,
    ChargeUpdate,
    PaymentCreate,
    PaymentRead,
)
from app.services.charge_service import ChargeService

router = APIRouter(tags=["charges"])


@router.get("/charges", response_model=list[ChargeRead])
async def list_charges(
    db: DbSession,
    current_user: CurrentUser,
    property_service_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    due_before: date | None = Query(None),
):
    items = await ChargeService(db).list_charges(
        current_user.id,
        property_service_id=property_service_id,
        status_filter=status_filter,
        due_before=due_before,
    )
    result = []
    for c in items:
        paid = await ChargeService(db).charges.paid_amount(c.id)
        result.append(
            ChargeRead.model_validate(c).model_copy(update={"paid_amount": paid})
        )
    return result


@router.post(
    "/charges", response_model=ChargeRead, status_code=status.HTTP_201_CREATED
)
async def create_charge(
    data: ChargeCreate, db: DbSession, current_user: CurrentUser
):
    c = await ChargeService(db).create_charge(current_user.id, data)
    return ChargeRead.model_validate(c)


@router.post(
    "/charges/calculate",
    response_model=ChargeRead,
    status_code=status.HTTP_201_CREATED,
)
async def calculate_charge(
    data: ChargeCalculateRequest, db: DbSession, current_user: CurrentUser
):
    c = await ChargeService(db).calculate_charge(current_user.id, data)
    return ChargeRead.model_validate(c)


@router.get("/charges/{charge_id}", response_model=ChargeRead)
async def get_charge(
    charge_id: int, db: DbSession, current_user: CurrentUser
):
    c = await ChargeService(db).get_charge(charge_id, current_user.id)
    paid = await ChargeService(db).charges.paid_amount(c.id)
    return ChargeRead.model_validate(c).model_copy(update={"paid_amount": paid})


@router.patch("/charges/{charge_id}", response_model=ChargeRead)
async def update_charge(
    charge_id: int,
    data: ChargeUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    c = await ChargeService(db).update_charge(charge_id, current_user.id, data)
    return ChargeRead.model_validate(c)


@router.post("/charges/{charge_id}/cancel", response_model=ChargeRead)
async def cancel_charge(
    charge_id: int, db: DbSession, current_user: CurrentUser
):
    c = await ChargeService(db).cancel_charge(charge_id, current_user.id)
    return ChargeRead.model_validate(c)


@router.get(
    "/charges/{charge_id}/payments", response_model=list[PaymentRead]
)
async def list_payments(
    charge_id: int, db: DbSession, current_user: CurrentUser
):
    items = await ChargeService(db).list_payments(charge_id, current_user.id)
    return [PaymentRead.model_validate(p) for p in items]


@router.post(
    "/charges/{charge_id}/payments",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_payment(
    charge_id: int,
    data: PaymentCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    p = await ChargeService(db).add_payment(charge_id, current_user.id, data)
    return PaymentRead.model_validate(p)


@router.delete(
    "/charges/{charge_id}/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_payment(
    charge_id: int,
    payment_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    await ChargeService(db).delete_payment(
        charge_id, payment_id, current_user.id
    )