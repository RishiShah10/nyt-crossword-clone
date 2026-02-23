import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .api import puzzles_router, auth_router, saves_router, rooms_router
from .config import settings
from .services import CacheService, PuzzleService
from .db.init_db import init_db
from .middleware import SecurityHeadersMiddleware, ErrorMaskingMiddleware

logger = logging.getLogger(__name__)

IS_PRODUCTION = bool(os.environ.get("VERCEL"))

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting NYT Crossword Clone Backend...")

    # Initialize database
    if settings.DATABASE_URL:
        await init_db()

    # Pre-fetch puzzles only when running as a long-lived server (not serverless)
    is_serverless = os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    if not is_serverless:
        cache_service = CacheService(cache_dir=settings.CACHE_DIR)
        puzzle_service = PuzzleService(
            cache_service=cache_service,
            github_base_url=settings.GITHUB_REPO_URL
        )

        try:
            await puzzle_service.prefetch_recent_puzzles(days=7)
        except Exception as e:
            logger.error("Error pre-fetching puzzles: %s", e)

    logger.info("Backend ready!")

    yield

    logger.info("Shutting down...")


# Create FastAPI app — disable docs/openapi in production
app = FastAPI(
    title="NYT Crossword Clone API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware (order matters — outermost runs first)
# 1. Error masking — catches unhandled exceptions, returns generic 500
app.add_middleware(ErrorMaskingMiddleware)

# 2. Security headers — X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.add_middleware(SecurityHeadersMiddleware)

# 3. CORS — locked to specific origins and methods
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register routers
app.include_router(puzzles_router)
app.include_router(auth_router)
app.include_router(saves_router)
app.include_router(rooms_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "NYT Crossword Clone API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
