from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import User
from ..dependencies import get_db, get_current_user
from ..services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    is_new_user: bool = False


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


@router.post("/google", response_model=LoginResponse)
async def google_login(request: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google ID token."""
    try:
        google_info = AuthService.verify_google_token(request.credential)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {e}"
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

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            is_new_user=is_new_user,
        ),
    )


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
