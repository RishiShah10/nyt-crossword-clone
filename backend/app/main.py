import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .api import puzzles_router, auth_router, saves_router
from .config import settings
from .services import CacheService, PuzzleService
from .db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("Starting NYT Crossword Clone Backend...")

    # Initialize database
    if settings.DATABASE_URL:
        await init_db()
    print(f"Cache directory: {settings.CACHE_DIR}")

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
            print(f"Error pre-fetching puzzles: {e}")

    print("Backend ready!")

    yield

    # Shutdown
    print("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="NYT Crossword Clone API",
    description="Backend API for NYT Crossword Clone application",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(puzzles_router)
app.include_router(auth_router)
app.include_router(saves_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "NYT Crossword Clone API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
