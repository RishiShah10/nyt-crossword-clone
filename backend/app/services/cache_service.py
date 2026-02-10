import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime


class CacheService:
    """Service for managing local file-based puzzle cache."""

    def __init__(self, cache_dir: str = "./cache"):
        """Initialize cache service with specified directory."""
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, date: str) -> Path:
        """Get cache file path for a given date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Path to cache file
        """
        # Organize by year/month for better file organization
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            year = date_obj.year
            month = f"{date_obj.month:02d}"
            day = f"{date_obj.day:02d}"
            cache_path = self.cache_dir / str(year) / month
            cache_path.mkdir(parents=True, exist_ok=True)
            return cache_path / f"{day}.json"
        except ValueError:
            # Fallback to flat structure if date parsing fails
            return self.cache_dir / f"{date}.json"

    def get(self, date: str) -> Optional[dict]:
        """Retrieve puzzle from cache.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Puzzle data dict if found, None otherwise
        """
        cache_path = self._get_cache_path(date)
        if cache_path.exists():
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error reading cache for {date}: {e}")
                return None
        return None

    def set(self, date: str, puzzle_data: dict) -> bool:
        """Store puzzle in cache.

        Args:
            date: Date string in YYYY-MM-DD format
            puzzle_data: Puzzle data dictionary to cache

        Returns:
            True if successful, False otherwise
        """
        cache_path = self._get_cache_path(date)
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(puzzle_data, f, indent=2)
            return True
        except (IOError, TypeError) as e:
            print(f"Error writing cache for {date}: {e}")
            return False

    def exists(self, date: str) -> bool:
        """Check if puzzle is in cache.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            True if puzzle is cached, False otherwise
        """
        return self._get_cache_path(date).exists()

    def clear(self, date: Optional[str] = None) -> bool:
        """Clear cache for specific date or entire cache.

        Args:
            date: Date string in YYYY-MM-DD format, or None to clear all

        Returns:
            True if successful, False otherwise
        """
        if date:
            cache_path = self._get_cache_path(date)
            if cache_path.exists():
                try:
                    cache_path.unlink()
                    return True
                except IOError as e:
                    print(f"Error clearing cache for {date}: {e}")
                    return False
            return True
        else:
            # Clear entire cache directory
            try:
                import shutil
                shutil.rmtree(self.cache_dir)
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                return True
            except Exception as e:
                print(f"Error clearing cache: {e}")
                return False
