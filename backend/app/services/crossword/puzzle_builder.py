"""
Puzzle builder — hybrid template + CSP + LLM pipeline.

Why this architecture:
  - faster_crowssword_generator's placement algorithm works great for large
    open grids (15x15) but produces poor 5x5 structure: unchecked cells,
    unbalanced across/down counts, words merely stacked rather than interlocked.
  - 5x5 NYT-style mini crosswords require:
      * Rotational symmetry
      * Every white cell covered by BOTH an across and a down word (checked cells)
      * Tight interlocking (5-6 across + 5-6 down entries)
    — all of which are guaranteed by precomputed valid templates + CSP.

Pipeline (best of both approaches):
  1. LLM generates themed word+clue pairs in CSV format (faster_crowssword_generator style).
     Words and clues are produced together → used to bias CSP toward theme words.
  2. CSP backtracking fills template slots, preferring LLM theme words.
     Guarantees valid grid structure and correct cross-letter consistency.
  3. ONE final LLM call receives ALL answered words and generates themed clues
     for every single word — giving the editor full puzzle context and forcing
     thematic angles even for common filler words.
  4. Final validation pass before returning.
"""
from __future__ import annotations

import datetime
import json
import logging
import random
from typing import Dict, List, Optional, Set, Tuple

from .csp_solver import solve
from .grid_template import (
    GridTemplate,
    compute_gridnums,
    get_template_pool,
)
from .slot_extractor import Slot, build_constraint_graph, extract_slots
from .word_list import WordList

logger = logging.getLogger(__name__)

# Module-level singletons
_word_list: Optional[WordList] = None


def _get_word_list() -> WordList:
    global _word_list
    if _word_list is None:
        _word_list = WordList()
        logger.info("WordList singleton initialised (%d words)", len(_word_list._words))
    return _word_list


# ─── Step 1: LLM word + clue generation ───────────────────────────────────────

_SYSTEM = (
    "You are a NYT Mini crossword puzzle editor. "
    "Given a theme, produce word+clue pairs for a 5x5 mini crossword. "
    "All words MUST be 3, 4, or 5 letters — no exceptions. "
    "Words must be common English words (no proper nouns, no abbreviations). "
    "Each clue must be short (under 8 words), accurate, and unambiguously lead "
    "to exactly that word. Tie clues to the theme where natural. "
    "Output format: one pair per line as WORD,clue text"
)

_USER = """\
Theme: {topics}

Generate 25 crossword word+clue pairs. Every word must be 3-5 letters.
Mix theme-specific words with common short English words that share letters
(they will cross each other in the grid).

Output only raw CSV lines — no headers, no numbers, no extra text:
WORD,clue text here
"""


async def _llm_word_clue_pairs(
    topics: str,
    openai_client,
) -> List[Tuple[str, str]]:
    """Single LLM call → list of (WORD, clue) tuples, 3-5 letters only."""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": _USER.format(topics=topics)},
            ],
            temperature=0.7,
            max_tokens=900,
        )
        raw = response.choices[0].message.content or ""
        return _parse_csv(raw)
    except Exception as exc:
        logger.error("Word/clue LLM call failed: %s", exc)
        return []


def _parse_csv(raw: str) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    seen: set[str] = set()
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",", 1)
        if len(parts) != 2:
            continue
        word = parts[0].strip().upper()
        clue = parts[1].strip()
        if not word or not clue:
            continue
        if not word.isalpha() or not (3 <= len(word) <= 5):
            continue
        if word in seen:
            continue
        seen.add(word)
        pairs.append((word, clue))
    logger.info("Parsed %d word+clue pairs from LLM", len(pairs))
    return pairs


# ─── Step 3: Unified themed clue generation for ALL answers ───────────────────

_FINAL_CLUE_SYSTEM = (
    "You are an expert NYT Mini crossword editor. Your skill is writing clues where "
    "EVERY answer connects to the puzzle theme, even ordinary English words. You find "
    "creative, accurate thematic angles for any word."
)

_FINAL_CLUE_USER = """\
This is a {topics}-themed mini crossword. Write one clue per answer.

RULES:
- EVERY clue must connect to "{topics}" — directly, metaphorically, or via wordplay
- Clues must be short (under 8 words), accurate, and lead unambiguously to that exact word
- Do NOT use the answer word in its own clue
- For directly related words: write a clear sports/theme clue
- For common words: find a creative angle (e.g. for a basketball theme: NEST → "Net + rest; where a swish ends up", EACH → "___ player on the court", TROOP → "Team, in military parlance")

Answers:
{answer_block}

Return ONLY valid JSON:
{{"clues": {{"1-across": "clue text", "2-down": "clue text", ...}}}}
"""


async def _generate_all_clues(
    numbered: Dict[str, str],
    topics: str,
    openai_client,
) -> Dict[str, str]:
    """Single LLM call that generates themed clues for ALL puzzle answers."""
    if not numbered:
        return {}
    answer_block = "\n".join(
        f"  {key}: {word}" for key, word in sorted(
            numbered.items(),
            key=lambda kv: (int(kv[0].split("-")[0]), kv[0].split("-")[1]),
        )
    )
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _FINAL_CLUE_SYSTEM},
                {"role": "user", "content": _FINAL_CLUE_USER.format(
                    topics=topics,
                    answer_block=answer_block,
                )},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=900,
        )
        data = json.loads(response.choices[0].message.content)
        # Normalize keys to lowercase e.g. "1-Across" → "1-across"
        return {k.lower(): v for k, v in data.get("clues", {}).items()}
    except Exception as exc:
        logger.warning("Unified clue generation failed: %s", exc)
        return {}


# ─── Step 2b: Slot → NYT clue-key mapping ─────────────────────────────────────

def _numbered_answers(
    assignment: Dict[Slot, str],
    gridnums: List[int],
) -> Dict[str, str]:
    """Map each slot to its NYT clue key, e.g. '3-across' → 'HOOP'."""
    from .grid_template import COLS
    result: Dict[str, str] = {}
    for slot, word in assignment.items():
        r, c = slot.start_row, slot.start_col
        num = gridnums[r * COLS + c]
        result[f"{num}-{slot.direction}"] = word
    return result


# ─── Step 4: NYT format assembly ──────────────────────────────────────────────

def _assemble(
    template: GridTemplate,
    assignment: Dict[Slot, str],
    clues: Dict[str, str],
    gridnums: List[int],
    title: str,
) -> dict:
    from .grid_template import ROWS, COLS

    grid_letters = template.to_nyt_grid(assignment)

    across_items = sorted(
        [(k, v) for k, v in clues.items() if k.endswith("-across")],
        key=lambda x: int(x[0].split("-")[0]),
    )
    down_items = sorted(
        [(k, v) for k, v in clues.items() if k.endswith("-down")],
        key=lambda x: int(x[0].split("-")[0]),
    )

    slot_by_key: Dict[str, str] = {}
    for slot, word in assignment.items():
        r, c = slot.start_row, slot.start_col
        num = gridnums[r * COLS + c]
        slot_by_key[f"{num}-{slot.direction}"] = word

    return {
        "size": {"rows": ROWS, "cols": COLS},
        "grid": grid_letters,
        "gridnums": gridnums,
        "clues": {
            "across": [f"{k.split('-')[0]}. {v}" for k, v in across_items],
            "down":   [f"{k.split('-')[0]}. {v}" for k, v in down_items],
        },
        "answers": {
            "across": [slot_by_key[k] for k, _ in across_items],
            "down":   [slot_by_key[k] for k, _ in down_items],
        },
        "title": title,
        "author": "AI Generator",
        "date": datetime.date.today().strftime("%Y-%m-%d"),
    }


def _validate(puzzle: dict, word_list: WordList) -> bool:
    from .grid_template import ROWS, COLS
    grid = puzzle.get("grid", [])
    if len(grid) != ROWS * COLS:
        return False
    if not puzzle["clues"]["across"] or not puzzle["clues"]["down"]:
        return False
    for answers in (puzzle["answers"]["across"], puzzle["answers"]["down"]):
        for word in answers:
            if not word_list.is_valid(word):
                logger.error("Validation: '%s' not in word list", word)
                return False
    return True


# ─── Public API ───────────────────────────────────────────────────────────────

async def build_puzzle(
    topics: str,
    title: str,
    openai_client,
    max_attempts: int = 20,
) -> dict:
    """
    Full pipeline:
      1. LLM → themed word+clue pairs (CSV, 3-5 letters) — used for CSP preference only
      2. CSP + valid 5x5 template → guaranteed proper mini crossword structure
         (checked cells, rotational symmetry, all slots filled)
      3. ONE final LLM call generates themed clues for ALL answered words together,
         giving full puzzle context and forcing thematic angles for every entry
      4. Validate + return NYT-format dict
    """
    word_list = _get_word_list()
    template_pool = get_template_pool()

    # Step 1 ── LLM word+clue pairs (used only to bias CSP toward theme words)
    pairs = await _llm_word_clue_pairs(topics, openai_client)

    # Validate theme words against our word list
    theme_words: Set[str] = set()
    for word, _clue in pairs:
        if word_list.is_valid(word):
            theme_words.add(word)

    logger.info(
        "Theme: %d LLM words, %d validated against word list: %s",
        len(pairs), len(theme_words), sorted(theme_words),
    )

    # Step 2 ── CSP solve across shuffled templates
    shuffled = random.sample(template_pool, len(template_pool))

    for attempt, template in enumerate(shuffled * (max_attempts // len(shuffled) + 1)):
        if attempt >= max_attempts:
            break

        slots = extract_slots(template)
        constraints = build_constraint_graph(slots)

        assignment = solve(
            slots,
            constraints,
            word_list,
            theme_words=theme_words,
            min_theme_words=min(3, len(theme_words)),
        )
        if assignment is None:
            continue

        # Step 3 ── Single unified LLM call for ALL clues with full puzzle context
        gridnums = compute_gridnums(template.grid)
        numbered = _numbered_answers(assignment, gridnums)

        clue_map = await _generate_all_clues(numbered, topics, openai_client)

        # Last-resort fallback: any key missing from LLM response gets a plain clue
        for key, word in numbered.items():
            if key not in clue_map:
                clue_map[key] = word.lower().capitalize()

        # Step 4 ── Assemble + validate
        puzzle = _assemble(template, assignment, clue_map, gridnums, title)
        if _validate(puzzle, word_list):
            theme_used = [w for w in assignment.values() if w in theme_words]
            logger.info(
                "Puzzle built on attempt %d. Theme words used: %s",
                attempt + 1, theme_used,
            )
            return puzzle

    raise RuntimeError(
        f"Could not generate a valid 5x5 puzzle for '{topics}' "
        f"after {max_attempts} attempts. Try different topics."
    )
