from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, RefreshRequest, TokenPair
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DbSession) -> UserRead:
    service = AuthService(db)
    user = await service.register(data)
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenPair)
async def login_json(data: LoginRequest, db: DbSession) -> TokenPair:
    """JSON-логин — для мобильного клиента и сторонних интеграций."""
    service = AuthService(db)
    user = await service.authenticate(data.email, data.password)
    return service.issue_tokens(user)


@router.post("/token", response_model=TokenPair)
async def login_form(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> TokenPair:
    """OAuth2-совместимый логин — для кнопки Authorize в Swagger UI."""
    service = AuthService(db)
    user = await service.authenticate(form.username, form.password)
    return service.issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, db: DbSession) -> TokenPair:
    service = AuthService(db)
    return await service.refresh(data.refresh_token)


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)