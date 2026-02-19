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

    # Cache settings
    CACHE_DIR: str = os.getenv("CACHE_DIR", "./cache")

    # GitHub repository
    GITHUB_REPO_URL: str = os.getenv(
        "GITHUB_REPO_URL",
        "https://raw.githubusercontent.com/doshea/nyt_crosswords/master"
    )


settings = Settings()
