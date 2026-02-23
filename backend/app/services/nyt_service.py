import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

NYT_API_BASE = "https://www.nytimes.com/svc/crosswords/v6/puzzle"
DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class NytAuthError(Exception):
    """Raised when the NYT cookie is invalid or expired (401/403)."""
    pass


class NytApiError(Exception):
    """Raised for non-auth NYT API failures."""
    pass


class NytService:
    """Client for fetching puzzles from the NYT crossword API (v6)."""

    def __init__(self, nyt_cookie: str):
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={"Cookie": f"NYT-S={nyt_cookie}"},
        )
        self._last_request_time: float = 0

    async def close(self):
        await self.http_client.aclose()

    async def fetch_puzzle(self, date: str, puzzle_type: str = "daily") -> Optional[dict]:
        """Fetch a puzzle from the NYT API and convert to doshea format.

        Args:
            date: Date string in YYYY-MM-DD format
            puzzle_type: "daily" or "mini"

        Returns:
            Puzzle data dict in doshea/archive format, or None if not found.

        Raises:
            NytAuthError: If the cookie is invalid/expired.
            NytApiError: For other API failures.
        """
        # Simple rate limiting: 1 request per second
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
        self._last_request_time = asyncio.get_event_loop().time()

        url = f"{NYT_API_BASE}/{puzzle_type}/{date}.json"
        try:
            response = await self.http_client.get(url)
        except httpx.RequestError as e:
            logger.error("Network error fetching NYT puzzle for %s: %s", date, e)
            raise NytApiError(f"Network error: {e}") from e

        if response.status_code in (401, 403):
            raise NytAuthError("NYT subscription cookie is invalid or expired")
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            logger.error("NYT API returned %d for %s", response.status_code, date)
            raise NytApiError(f"NYT API returned status {response.status_code}")

        try:
            nyt_data = response.json()
            return self._convert_to_doshea_format(nyt_data, date)
        except Exception as e:
            logger.error(
                "Error converting NYT puzzle for %s: %s\nResponse keys: %s",
                date, e, list(response.json().keys()) if response.text else "empty",
            )
            raise NytApiError(f"Format conversion error: {e}") from e

    @staticmethod
    def _convert_to_doshea_format(nyt_data: dict, date: str) -> dict:
        """Convert NYT v6 API response to doshea/archive format.

        NYT v6 structure: body[0].dimensions, body[0].cells[], body[0].clues[]
        """
        body = nyt_data["body"][0]
        dims = body["dimensions"]
        rows = dims["height"]
        cols = dims["width"]
        cells = body["cells"]
        clues_list = body["clues"]

        # Build cell_to_clue_number from cell labels
        cell_to_clue_number: dict[int, int] = {}
        for i, cell in enumerate(cells):
            label = cell.get("label")
            if label:
                cell_to_clue_number[i] = int(label)

        # Build grid and gridnums
        grid = []
        gridnums = []
        for i, cell in enumerate(cells):
            if not cell or cell.get("type") is None:
                # Black square (empty dict)
                grid.append(".")
            else:
                answer = cell.get("answer", "")
                grid.append(str(answer).upper() if answer else ".")
            gridnums.append(cell_to_clue_number.get(i, 0))

        # Build clues and answers by direction
        across_clues = []
        across_answers = []
        down_clues = []
        down_answers = []

        # Sort clues by direction then by label number
        sorted_clues = sorted(
            clues_list,
            key=lambda c: (0 if c.get("direction") == "Across" else 1, int(c.get("label", 0))),
        )

        for clue in sorted_clues:
            label = clue.get("label", "")
            text = clue.get("text", [])
            # text can be a list of segments or a plain string
            if isinstance(text, list):
                clue_text = "".join(
                    seg.get("plain", "") if isinstance(seg, dict) else str(seg) for seg in text
                )
            else:
                clue_text = str(text)

            formatted = f"{label}. {clue_text}"

            # Reconstruct answer from cell indices
            clue_cells = clue.get("cells", [])
            answer = ""
            for ci in clue_cells:
                if ci < len(cells):
                    cell_answer = cells[ci].get("answer", "")
                    answer += str(cell_answer).upper() if cell_answer else "?"

            direction = clue.get("direction", "")
            if direction == "Across":
                across_clues.append(formatted)
                across_answers.append(answer)
            elif direction == "Down":
                down_clues.append(formatted)
                down_answers.append(answer)

        # Extract metadata
        constructors = nyt_data.get("constructors", [])
        author = ", ".join(constructors) if constructors else None
        editor = nyt_data.get("editor", None)
        pub_date = nyt_data.get("publicationDate", date)
        copyright_text = nyt_data.get("copyright", None)

        # Derive day of week
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            dow = DAYS_OF_WEEK[date_obj.weekday()]
        except (ValueError, IndexError):
            dow = None

        title = nyt_data.get("title", None)

        return {
            "size": {"rows": rows, "cols": cols},
            "grid": grid,
            "gridnums": gridnums,
            "clues": {"across": across_clues, "down": down_clues},
            "answers": {"across": across_answers, "down": down_answers},
            "author": author,
            "editor": editor,
            "copyright": copyright_text,
            "publisher": "The New York Times",
            "date": pub_date,
            "dow": dow,
            "title": title,
        }
