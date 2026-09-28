from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import can_manage, require_role
from app.models.household import Household, HouseholdMember, Invitation
from app.repositories.household_repo import HouseholdRepository
from app.repositories.invitation_repo import InvitationRepository
from app.repositories.user_repo import UserRepository
from app.schemas.household import HouseholdCreate, HouseholdUpdate
from app.schemas.invitation import InvitationCreate


class HouseholdService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HouseholdRepository(db)
        self.invitations = InvitationRepository(db)
        self.users = UserRepository(db)

    async def _get_membership_or_404(
        self, household_id: int, user_id: int
    ) -> HouseholdMember:
        membership = await self.repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )
        return membership

    async def list_for_user(self, user_id: int) -> list[tuple[Household, str]]:
        return await self.repo.list_for_user(user_id)

    async def create(
        self, owner_id: int, data: HouseholdCreate
    ) -> Household:
        household = await self.repo.create(
            name=data.name,
            base_currency=data.base_currency,
            owner_id=owner_id,
        )
        await self.db.commit()
        await self.db.refresh(household)
        return household

    async def get(self, household_id: int, user_id: int) -> Household:
        await self._get_membership_or_404(household_id, user_id)
        household = await self.repo.get_by_id(household_id)
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
        return household

    async def update(
        self, household_id: int, user_id: int, data: HouseholdUpdate
    ) -> Household:
        membership = await self._get_membership_or_404(household_id, user_id)
        require_role(membership.role, "admin")

        household = await self.repo.get_by_id(household_id)
        if data.name is not None:
            household.name = data.name
        if data.base_currency is not None:
            household.base_currency = data.base_currency
        await self.db.commit()
        await self.db.refresh(household)
        return household

    async def delete(self, household_id: int, user_id: int) -> None:
        membership = await self._get_membership_or_404(household_id, user_id)
        if membership.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner can delete household",
            )
        household = await self.repo.get_by_id(household_id)
        if household.is_personal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete personal household",
            )
        await self.db.delete(household)
        await self.db.commit()

    async def list_members(
        self, household_id: int, user_id: int
    ) -> list[HouseholdMember]:
        await self._get_membership_or_404(household_id, user_id)
        return await self.repo.list_members(household_id)

    async def update_member_role(
        self, household_id: int, target_user_id: int, user_id: int, new_role: str
    ) -> HouseholdMember:
        actor = await self._get_membership_or_404(household_id, user_id)
        if not can_manage(actor.role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        target = await self.repo.get_membership(household_id, target_user_id)
        if not target:
            raise HTTPException(status_code=404, detail="Member not found")

        if target.role == "owner":
            raise HTTPException(
                status_code=400, detail="Cannot change owner's role"
            )
        if new_role == "owner":
            raise HTTPException(
                status_code=400,
                detail="Owner transfer not supported via this endpoint",
            )

        await self.repo.update_member_role(target, new_role)
        await self.db.commit()
        await self.db.refresh(target)
        return target

    async def remove_member(
        self, household_id: int, target_user_id: int, user_id: int
    ) -> None:
        actor = await self._get_membership_or_404(household_id, user_id)
        target = await self.repo.get_membership(household_id, target_user_id)
        if not target:
            raise HTTPException(status_code=404, detail="Member not found")

        # Владелец может удалять кого угодно, кроме себя;
        # остальные — только себя.
        if actor.user_id != target.user_id and not can_manage(actor.role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if target.role == "owner":
            raise HTTPException(
                status_code=400, detail="Cannot remove owner"
            )

        await self.repo.remove_member(target)
        await self.db.commit()

    async def create_invitation(
        self, household_id: int, user_id: int, data: InvitationCreate
    ) -> Invitation:
        actor = await self._get_membership_or_404(household_id, user_id)
        if not can_manage(actor.role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        email = data.email.lower()

        # Если пользователь уже участник — 409
        existing_user = await self.users.get_by_email(email)
        if existing_user:
            already = await self.repo.get_membership(household_id, existing_user.id)
            if already:
                raise HTTPException(
                    status_code=409, detail="User is already a member"
                )

        invitation = await self.invitations.create(
            household_id=household_id,
            email=email,
            role=data.role,
            invited_by=user_id,
        )
        await self.db.commit()
        await self.db.refresh(invitation)
        return invitation

    async def list_invitations(
        self, household_id: int, user_id: int
    ) -> list[Invitation]:
        actor = await self._get_membership_or_404(household_id, user_id)
        if not can_manage(actor.role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return await self.invitations.list_pending(household_id)

    async def accept_invitation(self, token: str, user_id: int) -> Household:
        invitation = await self.invitations.get_by_token(token)
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.accepted_at:
            raise HTTPException(status_code=400, detail="Invitation already used")

        from datetime import UTC, datetime

        if invitation.expires_at < datetime.now(UTC):
            raise HTTPException(status_code=400, detail="Invitation expired")

        # Проверим, что email приглашения совпадает с текущим пользователем
        user = await self.users.get_by_id(user_id)
        if not user or user.email.lower() != invitation.email:
            raise HTTPException(
                status_code=403,
                detail="Invitation is for a different email",
            )

        # Уже участник?
        existing = await self.repo.get_membership(invitation.household_id, user_id)
        if existing:
            raise HTTPException(status_code=409, detail="Already a member")

        self.db.add(
            HouseholdMember(
                household_id=invitation.household_id,
                user_id=user_id,
                role=invitation.role,
            )
        )
        from datetime import UTC, datetime

        invitation.accepted_at = datetime.now(UTC)
        await self.db.commit()

        household = await self.repo.get_by_id(invitation.household_id)
        return household