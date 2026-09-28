from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def expenses_by_month(
        self,
        household_ids: list[int],
        from_date: date,
        to_date: date,
        mode: str = "paid",
    ) -> list[dict]:
        """Расходы по месяцам с разбивкой по категориям.

        mode='paid'    — сумма платежей (payments.paid_at в периоде).
        mode='accrued' — сумма начислений (charges.period_end в периоде).
        """
        if not household_ids:
            return []

        if mode == "accrued":
            sql = text(
                """
                SELECT
                  to_char(date_trunc('month', c.period_end), 'YYYY-MM')
                    AS month,
                  st.category AS category,
                  c.currency AS currency,
                  SUM(c.amount) AS amount
                FROM charges c
                JOIN property_services ps
                  ON c.property_service_id = ps.id
                JOIN properties prop
                  ON ps.property_id = prop.id
                JOIN service_types st
                  ON ps.service_type_id = st.id
                WHERE prop.household_id = ANY(:hh)
                  AND c.period_end >= :d_from
                  AND c.period_end <= :d_to
                  AND c.status != 'cancelled'
                GROUP BY month, st.category, c.currency
                ORDER BY month, st.category
                """
            )
        else:
            sql = text(
                """
                SELECT
                  to_char(date_trunc('month', p.paid_at), 'YYYY-MM')
                    AS month,
                  st.category AS category,
                  c.currency AS currency,
                  SUM(p.amount) AS amount
                FROM payments p
                JOIN charges c
                  ON p.charge_id = c.id
                JOIN property_services ps
                  ON c.property_service_id = ps.id
                JOIN properties prop
                  ON ps.property_id = prop.id
                JOIN service_types st
                  ON ps.service_type_id = st.id
                WHERE prop.household_id = ANY(:hh)
                  AND p.paid_at >= :d_from
                  AND p.paid_at < (:d_to + INTERVAL '1 day')
                GROUP BY month, st.category, c.currency
                ORDER BY month, st.category
                """
            )

        rows = (
            await self.db.execute(
                sql,
                {"hh": household_ids, "d_from": from_date, "d_to": to_date},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def expenses_by_property(
        self,
        household_ids: list[int],
        from_date: date,
        to_date: date,
        mode: str = "paid",
    ) -> list[dict]:
        if not household_ids:
            return []

        if mode == "accrued":
            sql = text(
                """
                SELECT
                  prop.id AS property_id,
                  prop.name AS property_name,
                  prop.type AS property_type,
                  c.currency AS currency,
                  SUM(c.amount) AS amount
                FROM charges c
                JOIN property_services ps
                  ON c.property_service_id = ps.id
                JOIN properties prop
                  ON ps.property_id = prop.id
                WHERE prop.household_id = ANY(:hh)
                  AND c.period_end >= :d_from
                  AND c.period_end <= :d_to
                  AND c.status != 'cancelled'
                GROUP BY prop.id, prop.name, prop.type, c.currency
                ORDER BY amount DESC
                """
            )
        else:
            sql = text(
                """
                SELECT
                  prop.id AS property_id,
                  prop.name AS property_name,
                  prop.type AS property_type,
                  c.currency AS currency,
                  SUM(p.amount) AS amount
                FROM payments p
                JOIN charges c
                  ON p.charge_id = c.id
                JOIN property_services ps
                  ON c.property_service_id = ps.id
                JOIN properties prop
                  ON ps.property_id = prop.id
                WHERE prop.household_id = ANY(:hh)
                  AND p.paid_at >= :d_from
                  AND p.paid_at < (:d_to + INTERVAL '1 day')
                GROUP BY prop.id, prop.name, prop.type, c.currency
                ORDER BY amount DESC
                """
            )

        rows = (
            await self.db.execute(
                sql,
                {"hh": household_ids, "d_from": from_date, "d_to": to_date},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def consumption(
        self,
        household_ids: list[int],
        from_date: date,
        to_date: date,
    ) -> list[dict]:
        """Суммарное потребление по типу услуги за период.

        Для каждого счётчика берём разницу между соседними показаниями,
        где оба показания попадают в период.
        """
        if not household_ids:
            return []

        sql = text(
            """
            WITH ordered AS (
              SELECT
                r.meter_id,
                r.value,
                r.taken_at,
                LAG(r.value) OVER (
                  PARTITION BY r.meter_id ORDER BY r.taken_at
                ) AS prev_value,
                LAG(r.taken_at) OVER (
                  PARTITION BY r.meter_id ORDER BY r.taken_at
                ) AS prev_date
              FROM readings r
              WHERE r.taken_at <= :d_to
            )
            SELECT
              st.code AS service_type_code,
              st.name AS service_type_name,
              st.unit AS unit,
              SUM(ordered.value - ordered.prev_value) AS total_consumption
            FROM ordered
            JOIN meters m
              ON ordered.meter_id = m.id
            JOIN property_services ps
              ON m.property_service_id = ps.id
            JOIN properties prop
              ON ps.property_id = prop.id
            JOIN service_types st
              ON ps.service_type_id = st.id
            WHERE prop.household_id = ANY(:hh)
              AND ordered.prev_date IS NOT NULL
              AND ordered.taken_at >= :d_from
            GROUP BY st.code, st.name, st.unit
            ORDER BY st.code
            """
        )
        rows = (
            await self.db.execute(
                sql,
                {"hh": household_ids, "d_from": from_date, "d_to": to_date},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def upcoming(
        self,
        household_ids: list[int],
        days: int,
    ) -> list[dict]:
        if not household_ids:
            return []
        sql = text(
            """
            SELECT
              c.id AS charge_id,
              prop.name AS property_name,
              st.name AS service_name,
              c.amount AS amount,
              COALESCE((
                SELECT SUM(p.amount) FROM payments p
                WHERE p.charge_id = c.id
              ), 0) AS paid_amount,
              c.currency AS currency,
              c.due_date AS due_date,
              (c.due_date - :today) AS days_left,
              c.status AS status
            FROM charges c
            JOIN property_services ps
              ON c.property_service_id = ps.id
            JOIN properties prop
              ON ps.property_id = prop.id
            JOIN service_types st
              ON ps.service_type_id = st.id
            WHERE prop.household_id = ANY(:hh)
              AND c.status IN ('pending', 'partial', 'overdue')
              AND c.due_date <= (:today + (:days || ' days')::interval)
            ORDER BY c.due_date
            LIMIT 100
            """
        )
        from datetime import date as _date

        rows = (
            await self.db.execute(
                sql,
                {
                    "hh": household_ids,
                    "days": days,
                    "today": _date.today(),
                },
            )
        ).mappings().all()
        return [dict(r) for r in rows]