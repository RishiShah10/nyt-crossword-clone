import httpx
import logging
import random
from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING
from ..models.puzzle import Puzzle
from .cache_service import CacheService

if TYPE_CHECKING:
    from .nyt_service import NytService

logger = logging.getLogger(__name__)

# Boundary date: 2019-01-01+ uses NYT API, before uses GitHub archive
NYT_CUTOVER = datetime(2019, 1, 1)


class PuzzleService:
    """Service for fetching and managing crossword puzzles."""

    def __init__(
        self,
        cache_service: CacheService,
        github_base_url: str = "https://raw.githubusercontent.com/doshea/nyt_crosswords/master",
        nyt_service: Optional["NytService"] = None,
    ):
        self.cache_service = cache_service
        self.github_base_url = github_base_url.rstrip('/')
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.nyt_service = nyt_service

        # Date range for available puzzles
        self.min_date = datetime(2010, 1, 1)
        # Extend max_date to today if NYT service is available
        if self.nyt_service:
            self.max_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        else:
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

    async def get_puzzle(self, date: str, puzzle_type: str = "daily") -> Optional[Puzzle]:
        """Get puzzle for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format
            puzzle_type: "daily" or "mini"

        Returns:
            Puzzle model if found, None otherwise

        Raises:
            NytAuthError: Re-raised if NYT cookie is invalid.
        """
        # Validate date format
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            if not (self.min_date <= date_obj <= self.max_date):
                logger.info("Date %s is outside available range", date)
                return None
        except ValueError:
            logger.info("Invalid date format: %s", date)
            return None

        # Mini puzzles always come from NYT API (no GitHub archive)
        if puzzle_type == "mini":
            if not self.nyt_service:
                return None
            puzzle_data = await self._fetch_from_nyt(date, puzzle_type="mini")
        else:
            # Try cache first
            puzzle_data = self.cache_service.get(date)

            # Fetch from source if not cached
            if puzzle_data is None:
                if date_obj >= NYT_CUTOVER and self.nyt_service:
                    puzzle_data = await self._fetch_from_nyt(date)
                else:
                    puzzle_data = await self._fetch_from_github(date)

        # Parse and return puzzle
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

    async def _fetch_from_nyt(self, date: str, puzzle_type: str = "daily") -> Optional[dict]:
        """Fetch puzzle from the NYT v6 API.

        Raises:
            NytAuthError: Re-raised so the API layer can return 403.
        """
        from .nyt_service import NytAuthError, NytApiError

        try:
            puzzle_data = await self.nyt_service.fetch_puzzle(date, puzzle_type=puzzle_type)
            if puzzle_data and puzzle_type == "daily":
                self.cache_service.set(date, puzzle_data)
            return puzzle_data
        except NytAuthError:
            raise
        except NytApiError as e:
            logger.error("NYT API error for %s: %s", date, e)
            return None

    async def get_todays_puzzle(self) -> Optional[Puzzle]:
        """Get today's live NYT puzzle.

        Raises:
            NytAuthError: Re-raised if cookie is invalid.
        """
        today = datetime.now().strftime("%Y-%m-%d")
        return await self.get_puzzle(today)

    async def get_todays_mini(self) -> Optional[Puzzle]:
        """Get today's mini NYT puzzle.

        Raises:
            NytAuthError: Re-raised if cookie is invalid.
        """
        today = datetime.now().strftime("%Y-%m-%d")
        return await self.get_puzzle(today, puzzle_type="mini")

    async def get_random_puzzle(self) -> Optional[Puzzle]:
        """Get a random puzzle from the available date range.

        Returns:
            Random puzzle model if successful, None otherwise
        """
        time_delta = self.max_date - self.min_date

        # Try up to 10 random dates in case some don't have puzzles
        for _ in range(10):
            random_days = random.randint(0, time_delta.days)
            random_date = self.min_date + timedelta(days=random_days)
            date_str = random_date.strftime("%Y-%m-%d")

            puzzle = await self.get_puzzle(date_str)
            if puzzle:
                return puzzle

        return None

    async def get_random_mini(self) -> Optional[Puzzle]:
        """Get a random mini puzzle from the last 2 years.

        Returns:
            Random mini puzzle if successful, None otherwise

        Raises:
            NytAuthError: Re-raised if cookie is invalid.
        """
        today = datetime.now()
        min_mini_date = today - timedelta(days=730)

        for _ in range(10):
            random_days = random.randint(0, (today - min_mini_date).days)
            random_date = min_mini_date + timedelta(days=random_days)
            date_str = random_date.strftime("%Y-%m-%d")

            puzzle = await self.get_puzzle(date_str, puzzle_type="mini")
            if puzzle:
                return puzzle

        return None

    async def get_today_historical_puzzle(self) -> Optional[Puzzle]:
        """Get today's historical puzzle (same month/day from a past year).

        Returns:
            Historical puzzle for today's date from a random past year
        """
        today = datetime.now()
        month = today.month
        day = today.day

        # Pick a random year from the available range
        available_years = list(range(2010, 2019))
        random_year = random.choice(available_years)

        # Construct date string
        date_str = f"{random_year}-{month:02d}-{day:02d}"

        return await self.get_puzzle(date_str)

    async def prefetch_recent_puzzles(self, days: int = 7):
        """Pre-fetch and cache recent puzzles from the GitHub archive for faster access."""
        # Always prefetch from the GitHub archive (fast, no auth needed)
        base_date = datetime(2018, 12, 31)
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
