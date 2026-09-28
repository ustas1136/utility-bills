import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Invitation


class InvitationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        household_id: int,
        email: str,
        role: str,
        invited_by: int,
        ttl_days: int = 7,
    ) -> Invitation:
        invitation = Invitation(
            household_id=household_id,
            email=email.lower(),
            role=role,
            token=secrets.token_urlsafe(32),
            invited_by=invited_by,
            expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
        )
        self.db.add(invitation)
        await self.db.flush()
        return invitation

    async def get_by_token(self, token: str) -> Invitation | None:
        stmt = select(Invitation).where(Invitation.token == token)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_pending(self, household_id: int) -> list[Invitation]:
        stmt = (
            select(Invitation)
            .where(
                Invitation.household_id == household_id,
                Invitation.accepted_at.is_(None),
            )
            .order_by(Invitation.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())