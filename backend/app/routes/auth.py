"""Auth routes: register, login, me."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app import config
from app.core.rate_limit import (
    check_email_lockout,
    clear_failed_logins,
    get_real_client_ip,
    limiter,
    record_failed_login,
    register_demo_user,
)
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services import auth_service
from app.services.dependencies import get_current_user
from app.services.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(config.AUTH_REGISTER_RATE_LIMIT, key_func=get_real_client_ip)
async def register(request: Request, body: RegisterRequest) -> UserResponse:
    try:
        user = await auth_service.register_user(body.name, body.email, body.password)
        register_demo_user(body.email, str(user.id))
        return user
    except auth_service.EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(config.AUTH_LOGIN_RATE_LIMIT, key_func=get_real_client_ip)
@limiter.limit(config.AUTH_LOGIN_RATE_LIMIT_HOUR, key_func=get_real_client_ip)
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    # 1. Enforce 10 failed attempts per email per 15 minutes lockout
    await check_email_lockout(body.email)

    user = await auth_service.authenticate_user(body.email, body.password)
    if user is None:
        # Record failure without revealing whether the email exists
        await record_failed_login(body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Authentication succeeded: reset failed attempts
    await clear_failed_logins(body.email)
    register_demo_user(body.email, str(user.id))
    return TokenResponse(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return auth_service.serialize_user(current_user)
