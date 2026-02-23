from .puzzles import router as puzzles_router
from .auth import router as auth_router
from .saves import router as saves_router
from .rooms import router as rooms_router

__all__ = ["puzzles_router", "auth_router", "saves_router", "rooms_router"]
