"""
Run once to generate the two data files the crossword engine needs:
  backend/data/word_list.txt      — filtered English words (3-5 letters)
  backend/data/valid_templates.json — all valid 5x5 symmetric grid templates

Usage:
  cd backend
  python scripts/build_crossword_data.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from collections import deque
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# ENABLE1 — curated English word list (used in Scrabble/crosswords).
# No abbreviations, no proper nouns. Much cleaner than words_alpha.txt.
ENABLE_URL = (
    "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt"
)
# Peter Norvig's word frequency data — tab-separated "word\tcount" lines,
# sorted by frequency descending.  We take only the top 50k entries so that
# the CSP never picks obscure words like PSOAE, AMAHS, or TROIS.
FREQ_URL = "http://norvig.com/ngrams/count_1w.txt"

WORD_LIST_PATH = DATA_DIR / "word_list.txt"
TEMPLATES_PATH = DATA_DIR / "valid_templates.json"

ROWS, COLS = 5, 5
SIZE = ROWS * COLS  # 25
MAX_BLACK = 4
MIN_WORD_LEN = 3


# ─── Grid validation ──────────────────────────────────────────────────────────

def is_rotationally_symmetric(grid: list[bool]) -> bool:
    return all(grid[i] == grid[SIZE - 1 - i] for i in range(SIZE))


def is_connected(grid: list[bool]) -> bool:
    white = [
        (r, c)
        for r in range(ROWS)
        for c in range(COLS)
        if not grid[r * COLS + c]
    ]
    if not white:
        return False
    visited = {white[0]}
    queue = deque([white[0]])
    while queue:
        r, c = queue.popleft()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < ROWS and 0 <= nc < COLS:
                cell = (nr, nc)
                if cell not in visited and not grid[nr * COLS + nc]:
                    visited.add(cell)
                    queue.append(cell)
    return len(visited) == len(white)


def min_word_length_ok(grid: list[bool]) -> bool:
    """No across or down run of white cells may be shorter than MIN_WORD_LEN."""
    for r in range(ROWS):
        run = 0
        for c in range(COLS):
            if not grid[r * COLS + c]:
                run += 1
            else:
                if 0 < run < MIN_WORD_LEN:
                    return False
                run = 0
        if 0 < run < MIN_WORD_LEN:
            return False

    for c in range(COLS):
        run = 0
        for r in range(ROWS):
            if not grid[r * COLS + c]:
                run += 1
            else:
                if 0 < run < MIN_WORD_LEN:
                    return False
                run = 0
        if 0 < run < MIN_WORD_LEN:
            return False

    return True


def no_unchecked_cells(grid: list[bool]) -> bool:
    """Every white cell must belong to both an across word and a down word."""
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r * COLS + c]:
                continue
            left = c > 0 and not grid[r * COLS + c - 1]
            right = c < COLS - 1 and not grid[r * COLS + c + 1]
            in_across = left or right

            above = r > 0 and not grid[(r - 1) * COLS + c]
            below = r < ROWS - 1 and not grid[(r + 1) * COLS + c]
            in_down = above or below

            if not in_across or not in_down:
                return False
    return True


def is_valid_template(grid: list[bool]) -> bool:
    return (
        is_rotationally_symmetric(grid)
        and is_connected(grid)
        and min_word_length_ok(grid)
        and no_unchecked_cells(grid)
    )


# ─── Template enumeration ─────────────────────────────────────────────────────

def generate_templates() -> list[list[bool]]:
    """
    Enumerate all valid 5x5 symmetric grid templates.

    By rotational symmetry, choosing bits 0..12 fully determines the grid:
    - bits 0..11: paired with their mirror (24-i), so each bit sets 2 cells
    - bit 12: center cell (index 12 = cell (2,2)), sets 1 cell

    Total search space: 2^13 = 8192 — exhaustive enumeration runs in < 1s.
    """
    valid: list[list[bool]] = []

    for mask in range(2**13):
        grid = [False] * SIZE
        black_count = 0

        for i in range(13):
            if mask & (1 << i):
                grid[i] = True
                mirror = SIZE - 1 - i
                if mirror != i:
                    grid[mirror] = True
                    black_count += 2
                else:
                    black_count += 1  # center cell

        if black_count > MAX_BLACK:
            continue
        if is_valid_template(grid):
            valid.append(grid)

    return valid


# ─── Word list ────────────────────────────────────────────────────────────────

def build_word_list() -> list[str]:
    """
    Build a frequency-ordered list of 3-5 letter English words.

    Strategy:
      1. ENABLE1 is the authority for "real" words (curated Scrabble dictionary,
         no abbreviations, no proper nouns).  Eliminates SPAAD, MDNT, BEDOT, etc.
      2. Peter Norvig's word frequency data (count_1w.txt) provides frequency
         ranking.  We take only the TOP 25,000 entries from that file and require
         every kept word to appear in that set.  This eliminates obscure valid
         Scrabble words like PSOAE, AMAHS, TROIS, TYE, INERT that the CSP was
         using as filler, while retaining common words like NET, HOOP, BALL, TEAM.
    Words are saved most-common-first so WordList.get_candidates() can sort
    matches by insertion order (= frequency rank) instead of alphabetically.
    """
    print(f"Downloading ENABLE word list from {ENABLE_URL} …")
    with urllib.request.urlopen(ENABLE_URL, timeout=30) as resp:
        enable_raw = resp.read().decode("utf-8")

    enable_words: set[str] = set()
    for line in enable_raw.splitlines():
        w = line.strip().upper()
        if w and w.isalpha() and MIN_WORD_LEN <= len(w) <= 5:
            enable_words.add(w)
    print(f"  ENABLE: {len(enable_words):,} valid 3-5 letter words")

    TOP_N = 25_000
    print(f"Downloading frequency list from {FREQ_URL} …")
    with urllib.request.urlopen(FREQ_URL, timeout=60) as resp:
        freq_raw = resp.read().decode("utf-8")

    # Norvig format: "word\tcount" per line, already sorted frequency-descending.
    # Take the top TOP_N entries; build both a rank dict and a membership set.
    freq_rank: dict[str, int] = {}
    top_freq: set[str] = set()
    rank = 0
    for line in freq_raw.splitlines():
        if rank >= TOP_N:
            break
        parts = line.split("\t", 1)
        if not parts:
            continue
        w = parts[0].strip().upper()
        if w and w.isalpha():
            freq_rank[w] = rank
            top_freq.add(w)
            rank += 1
    print(f"  Norvig top-{TOP_N}: {len(top_freq):,} unique alpha words loaded")

    # Keep only ENABLE words that also appear in the top-frequency set.
    filtered = enable_words & top_freq
    print(f"  After intersection: {len(filtered):,} words remain")

    # Sort most-common-first (by Norvig rank), then alphabetically as tiebreak.
    words = sorted(filtered, key=lambda w: (freq_rank.get(w, 999_999), w))
    print(f"  Final word list: {len(words):,} words (frequency-ordered)")
    return words


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Word list
    if WORD_LIST_PATH.exists():
        print(f"Word list already exists at {WORD_LIST_PATH} — skipping download.")
        print("  (Delete the file and re-run to refresh.)")
    else:
        words = build_word_list()
        WORD_LIST_PATH.write_text("\n".join(words))
        print(f"Saved {len(words):,} words → {WORD_LIST_PATH}")

    # 2. Grid templates
    if TEMPLATES_PATH.exists():
        print(f"Templates already exist at {TEMPLATES_PATH} — skipping generation.")
        print("  (Delete the file and re-run to refresh.)")
    else:
        print("Generating valid 5x5 grid templates …")
        templates = generate_templates()
        # Store as list-of-lists of 0/1 integers (JSON-serializable)
        serializable = [[int(b) for b in t] for t in templates]
        TEMPLATES_PATH.write_text(json.dumps(serializable, separators=(",", ":")))
        print(f"Saved {len(templates)} valid templates → {TEMPLATES_PATH}")

    print("Done.")


if __name__ == "__main__":
    main()
