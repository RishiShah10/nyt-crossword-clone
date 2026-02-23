from __future__ import annotations
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from typing import Optional
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..db.models import User
from ..dependencies import get_db, get_current_user
from ..services.auth_service import AuthService
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Cookie settings
IS_PRODUCTION = bool(os.environ.get("VERCEL"))
COOKIE_NAME = "auth_token"
COOKIE_MAX_AGE = settings.JWT_EXPIRY_HOURS * 3600


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., max_length=4096)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    is_new_user: bool = False


class LoginResponse(BaseModel):
    user: UserResponse


@router.post("/google", response_model=LoginResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google ID token."""
    try:
        google_info = AuthService.verify_google_token(body.credential)
    except Exception:
        logger.warning("Failed Google token verification attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    # Find or create user
    result = await db.execute(
        select(User).where(User.google_id == google_info["google_id"])
    )
    user = result.scalar_one_or_none()

    is_new_user = False
    if user is None:
        user = User(
            google_id=google_info["google_id"],
            email=google_info["email"],
            name=google_info["name"],
            avatar_url=google_info["avatar_url"],
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        is_new_user = True
    else:
        user.name = google_info["name"]
        user.avatar_url = google_info["avatar_url"]
        await db.commit()

    token = AuthService.create_jwt(str(user.id), user.email)

    # Set JWT as httpOnly cookie instead of returning in body
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        path="/",
    )

    return LoginResponse(
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            is_new_user=is_new_user,
        ),
    )


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        path="/",
    )
    return {"status": "logged_out"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user."""
    result = await db.execute(
        select(User).where(User.id == current_user["id"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
    )
