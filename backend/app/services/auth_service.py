import jwt
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.household_repo import HouseholdRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import TokenPair
from app.schemas.user import UserCreate


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def register(self, data: UserCreate) -> User:
        email = data.email.lower()
        if await self.repo.get_by_email(email):
            raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
            )
        user = User(
            email=email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
        )
        user = await self.repo.create(user)
        await self.db.flush()

        # Личный household
        await HouseholdRepository(self.db).create(
            name=f"{user.full_name or user.email} (personal)",
            base_currency=user.base_currency,
            owner_id=user.id,
            is_personal=True,
        )

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.repo.get_by_email(email.lower())
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is inactive",
            )
        return user

    def issue_tokens(self, user: User) -> TokenPair:
        return TokenPair(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            ) from exc

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        user = await self.repo.get_by_id(int(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        return self.issue_tokens(user)