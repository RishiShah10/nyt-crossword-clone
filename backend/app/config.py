import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings:
    """Application settings and configuration."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS settings
    CORS_ORIGINS: list = os.getenv(
        "CORS_ORIGINS",
        "*"
    ).split(",")

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
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # Ably
    ABLY_API_KEY: str = os.getenv("ABLY_API_KEY", "")


settings = Settings()
