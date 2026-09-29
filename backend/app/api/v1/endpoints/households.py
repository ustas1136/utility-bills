from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.household import (
    HouseholdCreate,
    HouseholdRead,
    HouseholdUpdate,
    MemberRead,
    MemberUpdate,
)
from app.schemas.invitation import InvitationCreate, InvitationRead
from app.services.household_service import HouseholdService

router = APIRouter(prefix="/households", tags=["households"])


@router.get("", response_model=list[HouseholdRead])
async def list_households(db: DbSession, current_user: CurrentUser):
    rows = await HouseholdService(db).list_for_user(current_user.id)
    return [
        HouseholdRead.model_validate(h).model_copy(update={"role": role})
        for h, role in rows
    ]


@router.post("", response_model=HouseholdRead, status_code=status.HTTP_201_CREATED)
async def create_household(
    data: HouseholdCreate, db: DbSession, current_user: CurrentUser
):
    household = await HouseholdService(db).create(current_user.id, data)
    return HouseholdRead.model_validate(household).model_copy(
        update={"role": "owner"}
    )


@router.get("/{household_id}", response_model=HouseholdRead)
async def get_household(
    household_id: int, db: DbSession, current_user: CurrentUser
):
    household = await HouseholdService(db).get(household_id, current_user.id)
    return HouseholdRead.model_validate(household)


@router.patch("/{household_id}", response_model=HouseholdRead)
async def update_household(
    household_id: int,
    data: HouseholdUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    household = await HouseholdService(db).update(
        household_id, current_user.id, data
    )
    return HouseholdRead.model_validate(household)


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_household(
    household_id: int, db: DbSession, current_user: CurrentUser
):
    await HouseholdService(db).delete(household_id, current_user.id)


@router.get("/{household_id}/members", response_model=list[MemberRead])
async def list_members(
    household_id: int, db: DbSession, current_user: CurrentUser
):
    from app.repositories.user_repo import UserRepository

    members = await HouseholdService(db).list_members(
        household_id, current_user.id
    )
    user_repo = UserRepository(db)
    result = []
    for m in members:
        user = await user_repo.get_by_id(m.user_id)
        result.append(
            MemberRead.model_validate(m).model_copy(
                update={"email": user.email if user else None}
            )
        )
    return result


@router.patch("/{household_id}/members/{member_user_id}", response_model=MemberRead)
async def update_member_role(
    household_id: int,
    member_user_id: int,
    data: MemberUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    member = await HouseholdService(db).update_member_role(
        household_id, member_user_id, current_user.id, data.role
    )
    return MemberRead.model_validate(member)


@router.delete(
    "/{household_id}/members/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    household_id: int,
    member_user_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    await HouseholdService(db).remove_member(
        household_id, member_user_id, current_user.id
    )


@router.post(
    "/{household_id}/invitations",
    response_model=InvitationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    household_id: int,
    data: InvitationCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    inv = await HouseholdService(db).create_invitation(
        household_id, current_user.id, data
    )
    return InvitationRead.model_validate(inv)


@router.get(
    "/{household_id}/invitations", response_model=list[InvitationRead]
)
async def list_invitations(
    household_id: int, db: DbSession, current_user: CurrentUser
):
    invs = await HouseholdService(db).list_invitations(
        household_id, current_user.id
    )
    return [InvitationRead.model_validate(i) for i in invs]


@router.post("/invitations/{token}/accept", response_model=HouseholdRead)
async def accept_invitation(
    token: str, db: DbSession, current_user: CurrentUser
):
    household = await HouseholdService(db).accept_invitation(
        token, current_user.id
    )
    return HouseholdRead.model_validate(household)