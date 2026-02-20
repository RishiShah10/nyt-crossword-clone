from .engine import engine
from .models import Base


async def init_db():
    """Create all tables if they don't exist."""
    if engine is None:
        print("No DATABASE_URL configured, skipping DB init.")
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized.")
