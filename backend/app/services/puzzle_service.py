import httpx
import logging
import random
from datetime import datetime, timedelta
from typing import Optional
from ..models.puzzle import Puzzle
from .cache_service import CacheService

logger = logging.getLogger(__name__)

# Archive date range: doshea/nyt_crosswords GitHub archive
ARCHIVE_MIN = datetime(1977, 1, 1)
ARCHIVE_MAX = datetime(2018, 12, 31)


class PuzzleService:
    """Service for fetching and managing crossword puzzles."""

    def __init__(
        self,
        cache_service: CacheService,
        github_base_url: str = "https://raw.githubusercontent.com/doshea/nyt_crosswords/master",
    ):
        self.cache_service = cache_service
        self.github_base_url = github_base_url.rstrip('/')
        self.http_client = httpx.AsyncClient(timeout=30.0)

        self.min_date = ARCHIVE_MIN
        self.max_date = ARCHIVE_MAX

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
        """Get puzzle for a specific date from the GitHub archive.

        Args:
            date: Date string in YYYY-MM-DD format (1977-01-01 to 2018-12-31)

        Returns:
            Puzzle model if found, None otherwise
        """
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            if not (self.min_date <= date_obj <= self.max_date):
                logger.info("Date %s is outside available range (1977–2018)", date)
                return None
        except ValueError:
            logger.info("Invalid date format: %s", date)
            return None

        puzzle_data = self.cache_service.get(date)
        if puzzle_data is None:
            puzzle_data = await self._fetch_from_github(date)

        if puzzle_data:
            try:
                puzzle = Puzzle(**puzzle_data)
                if not puzzle.validate_grid():
                    logger.warning("Invalid grid dimensions for puzzle %s", date)
                    return None
                return puzzle
            except Exception as e:
                logger.error("Error parsing puzzle data for %s: %s", date, e)
                return None

        return None

    async def get_random_puzzle(self) -> Optional[Puzzle]:
        """Get a random puzzle from the archive (1977–2018)."""
        time_delta = self.max_date - self.min_date

        for _ in range(10):
            random_days = random.randint(0, time_delta.days)
            random_date = self.min_date + timedelta(days=random_days)
            date_str = random_date.strftime("%Y-%m-%d")

            puzzle = await self.get_puzzle(date_str)
            if puzzle:
                return puzzle

        return None

    async def get_today_historical_puzzle(self) -> Optional[Puzzle]:
        """Get a historical puzzle matching today's month/day from a random archive year."""
        today = datetime.now()
        month = today.month
        day = today.day

        available_years = list(range(1977, 2019))
        random.shuffle(available_years)

        for year in available_years:
            date_str = f"{year}-{month:02d}-{day:02d}"
            puzzle = await self.get_puzzle(date_str)
            if puzzle:
                return puzzle

        return None

    async def prefetch_recent_puzzles(self, days: int = 7):
        """Pre-fetch and cache recent archive puzzles for faster access."""
        base_date = ARCHIVE_MAX
        print(f"Pre-fetching last {days} puzzles from GitHub archive...")

        for i in range(days):
            date = base_date - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")

            if not self.cache_service.exists(date_str):
                puzzle = await self.get_puzzle(date_str)
                if puzzle:
                    print(f"  Cached: {date_str}")
                else:
                    print(f"  Not found: {date_str}")
