import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class Settings:
    """Application settings and configuration."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS settings — NO wildcard default
    CORS_ORIGINS: list = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
    ]

    # Cache settings — /tmp is the only writable dir on Vercel serverless
    CACHE_DIR: str = os.getenv("CACHE_DIR", "/tmp/cache")

    # GitHub repository
    GITHUB_REPO_URL: str = os.getenv(
        "GITHUB_REPO_URL",
        "https://raw.githubusercontent.com/doshea/nyt_crosswords/master"
    )

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # Ably
    ABLY_API_KEY: str = os.getenv("ABLY_API_KEY", "")

    # NYT Live Puzzles (optional — enables fetching 2019+ puzzles)
    NYT_COOKIE: str = os.getenv("NYT_COOKIE", "")

    def validate(self) -> None:
        """Validate critical settings at startup. Raises on misconfiguration."""
        is_prod = bool(os.environ.get("VERCEL"))

        if not self.JWT_SECRET or len(self.JWT_SECRET) < 32:
            if is_prod:
                raise ValueError(
                    "FATAL: JWT_SECRET must be set and at least 32 characters in production"
                )
            else:
                logger.warning("JWT_SECRET is weak or missing — acceptable for local dev only")

        if is_prod and not self.CORS_ORIGINS:
            raise ValueError("FATAL: CORS_ORIGINS must be set in production (no wildcard)")

        if is_prod and not self.DATABASE_URL:
            raise ValueError("FATAL: DATABASE_URL must be set in production")


settings = Settings()
settings.validate()
