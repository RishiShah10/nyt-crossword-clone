import logging
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from .db.engine import async_session_maker
from .services.auth_service import AuthService
import jwt

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

COOKIE_NAME = "auth_token"


async def get_db():
    """Yield a DB session per request."""
    if async_session_maker is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured"
        )
    async with async_session_maker() as session:
        yield session


def _extract_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """Extract JWT from httpOnly cookie first, then Bearer header as fallback."""
    # 1. Try httpOnly cookie (primary — used by browser)
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token
    # 2. Fallback to Authorization header (for non-browser clients / testing)
    if credentials:
        return credentials.credentials
    return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Require authenticated user. Raises 401 if missing/invalid token."""
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        payload = AuthService.verify_jwt(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception:
        logger.exception("Unexpected auth error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

    sub = payload.get("sub")
    email = payload.get("email")
    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure"
        )

    return {"id": sub, "email": email}


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Return user if authenticated, None otherwise."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    try:
        payload = AuthService.verify_jwt(token)
        sub = payload.get("sub")
        email = payload.get("email")
        if not sub or not email:
            return None
        return {"id": sub, "email": email}
    except Exception:
        return None
