"""
Crossword grid generator.

Adapted from https://github.com/Rperry2174/faster_crowssword_generator
Original algorithm by Rperry2174.

Placement-based approach:
  1. Sort words longest-first
  2. Place first word horizontally at grid center
  3. Each subsequent word must intersect an already-placed word
  4. Validate: bounds, letter conflicts, no accidental perpendicular words, no merging
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple


class Direction(str, Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@dataclass
class WordPlacement:
    word: str
    clue: str
    start_row: int
    start_col: int
    direction: Direction
    number: int = 0  # assigned after grid is trimmed


@dataclass
class CrosswordGrid:
    grid: List[List[Optional[str]]]   # None = empty cell
    word_placements: List[WordPlacement]
    width: int
    height: int


class CrosswordGenerator:
    """
    Places words onto a grid so they form a valid connected crossword.

    words_with_clues: list of (word, clue) tuples.
    valid_words: full English word set used for perpendicular-word validation.
        Should be large (e.g. all ENABLE words) so adjacent letter sequences
        are only rejected when they form sequences that aren't real words.
        If None, only the placed words themselves are used — this causes most
        placements to be rejected due to strict validation.
    grid_size: internal working grid — output is trimmed to the bounding box.
    """

    def __init__(
        self,
        words_with_clues: List[Tuple[str, str]],
        valid_words: Optional[set[str]] = None,
        grid_size: int = 17,
        strict_perp: bool = True,
    ) -> None:
        # Normalise + filter
        clean: List[Tuple[str, str]] = []
        seen: set[str] = set()
        for word, clue in words_with_clues:
            w = word.upper().strip()
            if len(w) >= 3 and w.isalpha() and w not in seen:
                clean.append((w, clue))
                seen.add(w)
        self.words_with_clues = clean
        self.grid_size = grid_size
        # strict_perp=False for mini grids: empty cells act as black squares,
        # so adjacent letters from different words are naturally separated and
        # don't need to form valid words.
        self.strict_perp = strict_perp
        # Use full word list for perpendicular validation; fall back to theme-only
        self.word_set: set[str] = valid_words if valid_words else {w for w, _ in clean}

    # ──────────────────────────────────────────────────────────── validation ──

    def _validate_perpendicular(
        self,
        grid: List[List[Optional[str]]],
        row: int,
        col: int,
        char: str,
        placement_dir: Direction,
    ) -> bool:
        """
        Placing `char` at (row, col) as part of a word in `placement_dir`:
        verify it won't accidentally form an invalid word in the perpendicular
        direction by joining with adjacent existing letters.

        In mini (5x5) mode strict_perp=False — empty cells act as black squares
        and words don't need perpendicular coverage of every cell.
        """
        if not self.strict_perp:
            return True
        if placement_dir == Direction.HORIZONTAL:
            # Scan the column for adjacent letters
            start_r = row
            while start_r > 0 and grid[start_r - 1][col] is not None:
                start_r -= 1
            end_r = row
            while end_r < self.grid_size - 1 and grid[end_r + 1][col] is not None:
                end_r += 1
            if start_r == row and end_r == row:
                return True  # no adjacent letters in column
            letters = [
                char if r == row else grid[r][col]
                for r in range(start_r, end_r + 1)
            ]
        else:  # VERTICAL — scan the row
            start_c = col
            while start_c > 0 and grid[row][start_c - 1] is not None:
                start_c -= 1
            end_c = col
            while end_c < self.grid_size - 1 and grid[row][end_c + 1] is not None:
                end_c += 1
            if start_c == col and end_c == col:
                return True
            letters = [
                char if c == col else grid[row][c]
                for c in range(start_c, end_c + 1)
            ]

        potential = "".join(c for c in letters if c is not None)
        return len(potential) <= 1 or potential in self.word_set

    def _check_boundaries(
        self,
        grid: List[List[Optional[str]]],
        word: str,
        start_row: int,
        start_col: int,
        direction: Direction,
    ) -> bool:
        """Prevent word merging: no existing letter immediately before/after word."""
        if direction == Direction.HORIZONTAL:
            if start_col > 0 and grid[start_row][start_col - 1] is not None:
                return False
            end_col = start_col + len(word)
            if end_col < self.grid_size and grid[start_row][end_col] is not None:
                return False
        else:
            if start_row > 0 and grid[start_row - 1][start_col] is not None:
                return False
            end_row = start_row + len(word)
            if end_row < self.grid_size and grid[end_row][start_col] is not None:
                return False
        return True

    def can_place(
        self,
        grid: List[List[Optional[str]]],
        word: str,
        start_row: int,
        start_col: int,
        direction: Direction,
    ) -> bool:
        """Full placement check: bounds + letter conflicts + perp words + boundaries."""
        if start_row < 0 or start_col < 0:
            return False
        if direction == Direction.HORIZONTAL:
            if start_col + len(word) > self.grid_size or start_row >= self.grid_size:
                return False
        else:
            if start_row + len(word) > self.grid_size or start_col >= self.grid_size:
                return False

        for i, char in enumerate(word):
            r = start_row + (i if direction == Direction.VERTICAL else 0)
            c = start_col + (i if direction == Direction.HORIZONTAL else 0)
            existing = grid[r][c]
            if existing is not None and existing != char:
                return False
            if existing is None and not self._validate_perpendicular(
                grid, r, c, char, direction
            ):
                return False

        return self._check_boundaries(grid, word, start_row, start_col, direction)

    def _has_intersection(
        self,
        grid: List[List[Optional[str]]],
        word: str,
        start_row: int,
        start_col: int,
        direction: Direction,
    ) -> bool:
        """At least one letter overlaps an existing placed letter."""
        for i, char in enumerate(word):
            r = start_row + (i if direction == Direction.VERTICAL else 0)
            c = start_col + (i if direction == Direction.HORIZONTAL else 0)
            if grid[r][c] == char:
                return True
        return False

    def _place(
        self,
        grid: List[List[Optional[str]]],
        word: str,
        start_row: int,
        start_col: int,
        direction: Direction,
    ) -> None:
        for i, char in enumerate(word):
            if direction == Direction.HORIZONTAL:
                grid[start_row][start_col + i] = char
            else:
                grid[start_row + i][start_col] = char

    # ──────────────────────────────────────────────────────────── generation ──

    def _find_candidates(
        self,
        grid: List[List[Optional[str]]],
        word: str,
    ) -> List[Tuple[int, int, Direction]]:
        """
        Systematically find every grid position where `word` intersects an
        existing placed letter.  Much more efficient than random sampling.

        For each letter in `word`, scan all matching cells in the grid and
        compute the resulting start position for both directions.
        """
        candidates: List[Tuple[int, int, Direction]] = []
        for char_idx, char in enumerate(word):
            for r in range(self.grid_size):
                for c in range(self.grid_size):
                    if grid[r][c] != char:
                        continue
                    # Horizontal: word letter `char_idx` lands at col c
                    h_sc = c - char_idx
                    if self.can_place(grid, word, r, h_sc, Direction.HORIZONTAL):
                        candidates.append((r, h_sc, Direction.HORIZONTAL))
                    # Vertical: word letter `char_idx` lands at row r
                    v_sr = r - char_idx
                    if self.can_place(grid, word, v_sr, c, Direction.VERTICAL):
                        candidates.append((v_sr, c, Direction.VERTICAL))
        return candidates

    def generate(self) -> CrosswordGrid:
        """
        Main generation loop. Returns a CrosswordGrid with None for empty cells.
        Caller should trim and assign gridnums.
        """
        if not self.words_with_clues:
            return CrosswordGrid(
                grid=[[None] * self.grid_size for _ in range(self.grid_size)],
                word_placements=[],
                width=self.grid_size,
                height=self.grid_size,
            )

        grid: List[List[Optional[str]]] = [
            [None] * self.grid_size for _ in range(self.grid_size)
        ]
        placements: List[WordPlacement] = []
        placed_words: set[str] = set()

        # Longest first — gives more intersection opportunities for shorter words
        sorted_pairs = sorted(self.words_with_clues, key=lambda x: len(x[0]), reverse=True)

        # Place first word horizontally at center
        first_word, first_clue = sorted_pairs[0]
        center_row = self.grid_size // 2
        center_col = (self.grid_size - len(first_word)) // 2
        self._place(grid, first_word, center_row, center_col, Direction.HORIZONTAL)
        placements.append(
            WordPlacement(first_word, first_clue, center_row, center_col, Direction.HORIZONTAL)
        )
        placed_words.add(first_word)

        # Place remaining words using intersection-targeting
        for word, clue in sorted_pairs[1:]:
            if word in placed_words:
                continue

            candidates = self._find_candidates(grid, word)
            if not candidates:
                continue  # no intersection points — skip word

            random.shuffle(candidates)  # variety across requests

            for sr, sc, direction in candidates:
                # _find_candidates already checked can_place; verify intersection
                if self._has_intersection(grid, word, sr, sc, direction):
                    self._place(grid, word, sr, sc, direction)
                    placements.append(WordPlacement(word, clue, sr, sc, direction))
                    placed_words.add(word)
                    break

            if len(placements) >= 14:  # quality cap
                break

        return CrosswordGrid(
            grid=grid,
            word_placements=placements,
            width=self.grid_size,
            height=self.grid_size,
        )
