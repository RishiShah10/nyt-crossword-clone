import httpx
import random
from datetime import datetime, timedelta
from typing import Optional
from ..models.puzzle import Puzzle
from .cache_service import CacheService


class PuzzleService:
    """Service for fetching and managing crossword puzzles."""

    def __init__(
        self,
        cache_service: CacheService,
        github_base_url: str = "https://raw.githubusercontent.com/doshea/nyt_crosswords/master"
    ):
        """Initialize puzzle service.

        Args:
            cache_service: Cache service instance
            github_base_url: Base URL for NYT crosswords GitHub repository
        """
        self.cache_service = cache_service
        self.github_base_url = github_base_url.rstrip('/')
        self.http_client = httpx.AsyncClient(timeout=30.0)

        # Date range for available puzzles (1977-01-01 to 2018-12-31)
        self.min_date = datetime(1977, 1, 1)
        self.max_date = datetime(2018, 12, 31)

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()

    def _get_github_url(self, date: str) -> str:
        """Construct GitHub URL for a puzzle date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Full GitHub URL to puzzle JSON
        """
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        year = date_obj.year
        month = f"{date_obj.month:02d}"
        day = f"{date_obj.day:02d}"
        return f"{self.github_base_url}/{year}/{month}/{day}.json"

    async def _fetch_from_github(self, date: str) -> Optional[dict]:
        """Fetch puzzle from GitHub repository.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Puzzle data dict if successful, None otherwise
        """
        url = self._get_github_url(date)
        try:
            response = await self.http_client.get(url)
            if response.status_code == 200:
                puzzle_data = response.json()
                # Cache the fetched puzzle
                self.cache_service.set(date, puzzle_data)
                return puzzle_data
            elif response.status_code == 404:
                print(f"Puzzle not found for {date}")
                return None
            else:
                print(f"Error fetching puzzle: {response.status_code}")
                return None
        except httpx.RequestError as e:
            print(f"Request error fetching puzzle for {date}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error fetching puzzle for {date}: {e}")
            return None

    async def get_puzzle(self, date: str) -> Optional[Puzzle]:
        """Get puzzle for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Puzzle model if found, None otherwise
        """
        # Validate date format
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            if not (self.min_date <= date_obj <= self.max_date):
                print(f"Date {date} is outside available range (1977-2018)")
                return None
        except ValueError:
            print(f"Invalid date format: {date}")
            return None

        # Try cache first
        puzzle_data = self.cache_service.get(date)

        # Fetch from GitHub if not cached
        if puzzle_data is None:
            puzzle_data = await self._fetch_from_github(date)

        # Parse and return puzzle
        if puzzle_data:
            try:
                puzzle = Puzzle(**puzzle_data)
                if not puzzle.validate_grid():
                    print(f"Invalid grid dimensions for puzzle {date}")
                    return None
                return puzzle
            except Exception as e:
                print(f"Error parsing puzzle data for {date}: {e}")
                return None

        return None

    async def get_random_puzzle(self) -> Optional[Puzzle]:
        """Get a random puzzle from the available date range.

        Returns:
            Random puzzle model if successful, None otherwise
        """
        # Generate random date between min and max
        time_delta = self.max_date - self.min_date
        random_days = random.randint(0, time_delta.days)
        random_date = self.min_date + timedelta(days=random_days)
        date_str = random_date.strftime("%Y-%m-%d")

        return await self.get_puzzle(date_str)

    async def get_today_historical_puzzle(self) -> Optional[Puzzle]:
        """Get today's historical puzzle (same month/day from a past year).

        Returns:
            Historical puzzle for today's date from a random past year
        """
        today = datetime.now()
        month = today.month
        day = today.day

        # Pick a random year from the available range
        available_years = list(range(1977, 2019))
        random_year = random.choice(available_years)

        # Construct date string
        date_str = f"{random_year}-{month:02d}-{day:02d}"

        return await self.get_puzzle(date_str)

    async def prefetch_recent_puzzles(self, days: int = 7):
        """Pre-fetch and cache recent puzzles for faster access.

        Args:
            days: Number of days to prefetch (from most recent backward)
        """
        print(f"Pre-fetching last {days} puzzles from 2018...")
        base_date = self.max_date

        for i in range(days):
            date = base_date - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")

            if not self.cache_service.exists(date_str):
                puzzle = await self.get_puzzle(date_str)
                if puzzle:
                    print(f"  Cached: {date_str}")
                else:
                    print(f"  Not found: {date_str}")
