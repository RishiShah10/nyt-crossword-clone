from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from .db.engine import async_session_maker
from .services.auth_service import AuthService

security = HTTPBearer(auto_error=False)


async def get_db():
    """Yield a DB session per request."""
    if async_session_maker is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured"
        )
    async with async_session_maker() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Require authenticated user. Raises 401 if missing/invalid token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        payload = AuthService.verify_jwt(credentials.credentials)
        return {"id": payload["sub"], "email": payload["email"]}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Return user if authenticated, None otherwise."""
    if credentials is None:
        return None
    try:
        payload = AuthService.verify_jwt(credentials.credentials)
        return {"id": payload["sub"], "email": payload["email"]}
    except Exception:
        return None
