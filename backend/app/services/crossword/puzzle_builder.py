from __future__ import annotations

import datetime
import json
import logging
import random
from typing import Dict, List, Optional, Set

from .clue_generator import generate_clues
from .csp_solver import Assignment, solve
from .grid_template import (
    GridTemplate,
    compute_gridnums,
    get_template_pool,
    sample_template,
)
from .slot_extractor import Slot, build_constraint_graph, extract_slots
from .word_list import WordList

logger = logging.getLogger(__name__)

# Module-level singletons — loaded once at startup, reused across requests.
_word_list: Optional[WordList] = None


def _get_word_list() -> WordList:
    global _word_list
    if _word_list is None:
        _word_list = WordList()
        logger.info("WordList singleton initialised")
    return _word_list


# ─── Theme word expansion via LLM ─────────────────────────────────────────────

async def expand_theme_words(
    topics: str,
    openai_client,
    word_list: WordList,
) -> Set[str]:
    """
    Use LLM as a thesaurus to derive candidate theme words from the topics string.

    The LLM only produces word candidates here — it has no structural role.
    Every candidate is verified against the word list before use.

    Returns empty set if expansion fails (CSP will still run; just no theme pressure).
    """
    prompt = (
        f"List 30 English words (3 to 5 letters each, uppercase) "
        f"strongly associated with this theme: {topics}\n"
        "Include both common words and theme-specific terms.\n"
        'Return ONLY valid JSON: {"words": ["WORD1", "WORD2", ...]}'
    )
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=300,
        )
        data = json.loads(response.choices[0].message.content)
        candidates: List[str] = data.get("words", [])
        valid = {
            w.upper()
            for w in candidates
            if isinstance(w, str)
            and w.isalpha()
            and 3 <= len(w) <= 5
            and word_list.is_valid(w.upper())
        }
        logger.info(
            "Theme expansion: %d candidates → %d valid words for '%s'",
            len(candidates), len(valid), topics,
        )
        return valid
    except Exception as exc:
        logger.warning("Theme word expansion failed: %s", exc)
        return set()


# ─── Slot → clue-key mapping ──────────────────────────────────────────────────

def _build_numbered_answers(
    assignment: Assignment,
    gridnums: List[int],
    grid: List[bool],
) -> Dict[str, str]:
    """
    Map each slot to its NYT clue key (e.g. "3-across", "5-down")
    using the derived gridnums.
    """
    from .grid_template import ROWS, COLS

    numbered: Dict[str, str] = {}
    for slot, word in assignment.items():
        r, c = slot.start_row, slot.start_col
        num = gridnums[r * COLS + c]
        key = f"{num}-{slot.direction}"
        numbered[key] = word
    return numbered


# ─── NYT JSON assembly ────────────────────────────────────────────────────────

def _assemble_nyt_json(
    template: GridTemplate,
    assignment: Assignment,
    clues_by_key: Dict[str, str],
    gridnums: List[int],
    title: str,
) -> dict:
    """
    Build the full NYT-format puzzle JSON from the solved assignment.

    The format matches what the frontend's buildGrid() and buildClueMap() expect:
      size, grid, gridnums, clues (with number prefix), answers, title, author, date
    """
    grid_letters = template.to_nyt_grid(assignment)

    # Sort by clue number for consistent ordering
    across_items = sorted(
        [(k, v) for k, v in clues_by_key.items() if k.endswith("-across")],
        key=lambda x: int(x[0].split("-")[0]),
    )
    down_items = sorted(
        [(k, v) for k, v in clues_by_key.items() if k.endswith("-down")],
        key=lambda x: int(x[0].split("-")[0]),
    )

    # Build slot lookup: key → word
    slot_by_key: Dict[str, str] = {}
    for slot, word in assignment.items():
        from .grid_template import COLS
        r, c = slot.start_row, slot.start_col
        num = gridnums[r * COLS + c]
        slot_by_key[f"{num}-{slot.direction}"] = word

    # NYT format: clue strings include the number prefix ("1. Clue text")
    across_clues = [
        f"{k.split('-')[0]}. {v}" for k, v in across_items
    ]
    down_clues = [
        f"{k.split('-')[0]}. {v}" for k, v in down_items
    ]
    across_answers = [slot_by_key[k] for k, _ in across_items]
    down_answers = [slot_by_key[k] for k, _ in down_items]

    return {
        "size": {"rows": 5, "cols": 5},
        "grid": grid_letters,
        "gridnums": gridnums,
        "clues": {
            "across": across_clues,
            "down": down_clues,
        },
        "answers": {
            "across": across_answers,
            "down": down_answers,
        },
        "title": title,
        "author": "AI Generator",
        "date": datetime.date.today().strftime("%Y-%m-%d"),
    }


# ─── Final validation ─────────────────────────────────────────────────────────

def _validate_puzzle(puzzle: dict, word_list: WordList) -> bool:
    """
    Final deterministic validation pass before returning the puzzle.
    Guards against any assembly bugs.
    """
    grid = puzzle.get("grid", [])
    gridnums = puzzle.get("gridnums", [])

    if len(grid) != 25 or len(gridnums) != 25:
        logger.error("Validation failed: grid/gridnums length mismatch")
        return False

    for answers in (
        puzzle.get("answers", {}).get("across", []),
        puzzle.get("answers", {}).get("down", []),
    ):
        for word in answers:
            if not word_list.is_valid(word):
                logger.error("Validation failed: '%s' not in word list", word)
                return False

    # Verify cross letters: reconstruct cell map from across answers,
    # then check each down answer letter-by-letter.
    # (The CSP guarantees this, but we verify for defence-in-depth.)
    from .grid_template import ROWS, COLS
    cell_map: Dict = {}
    for slot_key, word in zip(
        puzzle["clues"]["across"], puzzle["answers"]["across"]
    ):
        num = int(slot_key.split(".")[0])
        # Find starting cell for this number
        for i, gn in enumerate(gridnums):
            if gn == num:
                r, c = i // COLS, i % COLS
                for j, letter in enumerate(word):
                    cell_map[(r, c + j)] = letter
                break

    for slot_key, word in zip(
        puzzle["clues"]["down"], puzzle["answers"]["down"]
    ):
        num = int(slot_key.split(".")[0])
        for i, gn in enumerate(gridnums):
            if gn == num:
                r, c = i // COLS, i % COLS
                for j, letter in enumerate(word):
                    existing = cell_map.get((r + j, c))
                    if existing and existing != letter:
                        logger.error(
                            "Cross-letter mismatch at (%d,%d): across=%s down=%s",
                            r + j, c, existing, letter,
                        )
                        return False
                break

    return True


# ─── Public API ───────────────────────────────────────────────────────────────

async def build_puzzle(
    topics: str,
    title: str,
    openai_client,
    max_attempts: int = 20,
    min_theme_words: int = 1,
) -> dict:
    """
    Full hybrid pipeline:
      1. Expand theme words via LLM (one call, used as thesaurus only)
      2. Pick a random grid template (deterministic)
      3. Extract slots + constraint graph (deterministic)
      4. CSP backtracking solver (deterministic — guaranteed valid words + crosses)
      5. Generate clues via LLM (confirmed answers only, pure creativity)
      6. Final validation pass (deterministic)

    Retries up to max_attempts with different templates if the CSP finds
    no solution (rare — happens when theme words are very uncommon).

    Returns NYT-format puzzle dict.
    Raises RuntimeError if all attempts fail.
    """
    word_list = _get_word_list()
    template_pool = get_template_pool()

    # Phase 1: expand theme words (LLM as thesaurus)
    theme_words = await expand_theme_words(topics, openai_client, word_list)
    logger.info("Theme words: %s", theme_words)

    # Shuffle template order for variety across retries
    shuffled_pool = random.sample(template_pool, len(template_pool))

    for attempt in range(max_attempts):
        template = shuffled_pool[attempt % len(shuffled_pool)]
        logger.debug("Attempt %d: trying template %s", attempt + 1, template.grid[:5])

        # Phase 2 + 3: slots + constraints
        slots = extract_slots(template)
        constraints = build_constraint_graph(slots)

        # Phase 4: CSP solve
        assignment = solve(
            slots,
            constraints,
            word_list,
            theme_words=theme_words,
            min_theme_words=min(min_theme_words, len(theme_words)),
        )
        if assignment is None:
            logger.debug("Attempt %d: CSP returned no solution", attempt + 1)
            continue

        # Phase 5: compute gridnums + build answer key
        gridnums = compute_gridnums(template.grid)
        numbered_answers = _build_numbered_answers(assignment, gridnums, template.grid)

        # Phase 5: clue generation (LLM — confirmed answers only)
        clues_by_key = await generate_clues(numbered_answers, topics, openai_client)

        # Phase 6: assemble + validate
        puzzle = _assemble_nyt_json(template, assignment, clues_by_key, gridnums, title)

        if _validate_puzzle(puzzle, word_list):
            logger.info(
                "Puzzle built successfully on attempt %d. "
                "Theme words used: %s",
                attempt + 1,
                [w for w in assignment.values() if w in theme_words],
            )
            return puzzle

        logger.warning("Attempt %d: final validation failed — retrying", attempt + 1)

    raise RuntimeError(
        f"Could not generate a valid puzzle for topics '{topics}' "
        f"after {max_attempts} attempts. Try different topics."
    )
