"""Vercel serverless entry point — exposes the FastAPI app."""

import sys
import os

# Add backend directory to Python path so `from app.xxx` imports work
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, backend_dir)

# Set VERCEL flag so the app knows it's running serverless
os.environ.setdefault("VERCEL", "1")

from app.main import app  # noqa: E402, F401
