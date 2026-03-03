from __future__ import annotations

import json
import logging
import random
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
DEFAULT_TEMPLATES_FILE = _DATA_DIR / "valid_templates.json"

ROWS, COLS = 5, 5
SIZE = ROWS * COLS  # 25


class GridTemplate:
    """
    A validated 5x5 crossword grid template.

    grid: flat list of 25 bools, True = black square.
    Guaranteed properties:
      - 180° rotationally symmetric
      - All white cells connected (BFS)
      - No word shorter than 3 letters
      - No unchecked cells (every white cell in both across and down word)
    """

    def __init__(self, grid: List[bool]) -> None:
        assert len(grid) == SIZE
        self.grid = grid

    def is_black(self, row: int, col: int) -> bool:
        return self.grid[row * COLS + col]

    def to_nyt_grid(self, assignment: dict) -> List[str]:
        """
        Build the NYT-format flat grid array from a slot assignment.
        assignment: {Slot -> word_str}
        Returns list of 25 strings: uppercase letter or '.'
        """
        from .slot_extractor import Slot  # local import to avoid circular

        cell_map: dict[tuple, str] = {}
        for slot, word in assignment.items():
            for pos, cell in enumerate(slot.cells):
                cell_map[cell] = word[pos]

        result = []
        for r in range(ROWS):
            for c in range(COLS):
                if self.grid[r * COLS + c]:
                    result.append(".")
                else:
                    result.append(cell_map.get((r, c), ""))
        return result


_template_pool: Optional[List[GridTemplate]] = None


def _load_templates(path: Path) -> List[GridTemplate]:
    if not path.exists():
        raise FileNotFoundError(
            f"Templates not found at {path}. "
            "Run: python scripts/build_crossword_data.py"
        )
    raw: List[List[int]] = json.loads(path.read_text())
    templates = [GridTemplate([bool(v) for v in t]) for t in raw]
    logger.info("Loaded %d grid templates from %s", len(templates), path)
    return templates


def get_template_pool(path: Optional[str] = None) -> List[GridTemplate]:
    """Return the cached template pool, loading from disk on first call."""
    global _template_pool
    if _template_pool is None:
        p = Path(path) if path else DEFAULT_TEMPLATES_FILE
        _template_pool = _load_templates(p)
    return _template_pool


def sample_template(seed: Optional[int] = None) -> GridTemplate:
    """Return a random template from the pool."""
    pool = get_template_pool()
    if not pool:
        raise RuntimeError("Template pool is empty")
    rng = random.Random(seed)
    return rng.choice(pool)


def compute_gridnums(grid: List[bool]) -> List[int]:
    """
    Derive NYT-style grid numbers from scratch.
    A cell gets a number if it starts an across word (leftmost white cell
    in a run of ≥2) or a down word (topmost white cell in a run of ≥2).
    Numbers are assigned left-to-right, top-to-bottom.
    """
    gridnums = [0] * SIZE
    num = 1
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r * COLS + c]:
                continue  # black cell
            starts_across = (c == 0 or grid[r * COLS + c - 1]) and (
                c + 1 < COLS and not grid[r * COLS + c + 1]
            )
            starts_down = (r == 0 or grid[(r - 1) * COLS + c]) and (
                r + 1 < ROWS and not grid[(r + 1) * COLS + c]
            )
            if starts_across or starts_down:
                gridnums[r * COLS + c] = num
                num += 1
    return gridnums
