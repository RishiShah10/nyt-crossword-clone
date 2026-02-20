from .puzzles import router as puzzles_router
from .auth import router as auth_router
from .saves import router as saves_router

__all__ = ["puzzles_router", "auth_router", "saves_router"]
