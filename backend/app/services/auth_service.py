import jwt
from datetime import datetime, timedelta, timezone
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from ..config import settings


class AuthService:
    @staticmethod
    def verify_google_token(credential: str) -> dict:
        """Verify Google ID token and return user info."""
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name", ""),
            "avatar_url": idinfo.get("picture", ""),
        }

    @staticmethod
    def create_jwt(user_id: str, email: str) -> str:
        """Create a JWT token for the user."""
        payload = {
            "sub": user_id,
            "email": email,
            "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    @staticmethod
    def verify_jwt(token: str) -> dict:
        """Verify JWT and return payload. Raises on invalid/expired."""
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
