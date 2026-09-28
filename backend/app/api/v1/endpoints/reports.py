from datetime import date, timedelta

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.reports import (
    ByPropertyReport,
    ConsumptionReport,
    ExpensesReport,
    UpcomingReport,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])

MODE_PATTERN = r"^(paid|accrued)$"


def _default_from() -> date:
    today = date.today()
    return today.replace(day=1) - timedelta(days=180)  # 6 месяцев назад


def _default_to() -> date:
    return date.today()


@router.get("/expenses", response_model=ExpensesReport)
async def expenses(
    db: DbSession,
    current_user: CurrentUser,
    from_date: date = Query(default_factory=_default_from),
    to_date: date = Query(default_factory=_default_to),
    mode: str = Query("paid", pattern=MODE_PATTERN),
):
    return await ReportService(db).expenses(
        current_user.id, from_date, to_date, mode
    )


@router.get("/by-property", response_model=ByPropertyReport)
async def by_property(
    db: DbSession,
    current_user: CurrentUser,
    from_date: date = Query(default_factory=_default_from),
    to_date: date = Query(default_factory=_default_to),
    mode: str = Query("paid", pattern=MODE_PATTERN),
):
    return await ReportService(db).by_property(
        current_user.id, from_date, to_date, mode
    )


@router.get("/consumption", response_model=ConsumptionReport)
async def consumption(
    db: DbSession,
    current_user: CurrentUser,
    from_date: date = Query(default_factory=_default_from),
    to_date: date = Query(default_factory=_default_to),
):
    return await ReportService(db).consumption(
        current_user.id, from_date, to_date
    )


@router.get("/upcoming", response_model=UpcomingReport)
async def upcoming(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
):
    return await ReportService(db).upcoming(current_user.id, days)


@router.get("/export.csv", response_class=PlainTextResponse)
async def export_csv(
    db: DbSession,
    current_user: CurrentUser,
    from_date: date = Query(default_factory=_default_from),
    to_date: date = Query(default_factory=_default_to),
    mode: str = Query("paid", pattern=MODE_PATTERN),
):
    csv = await ReportService(db).export_csv(
        current_user.id, from_date, to_date, mode
    )
    return PlainTextResponse(
        csv,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=expenses.csv"
        },
    )