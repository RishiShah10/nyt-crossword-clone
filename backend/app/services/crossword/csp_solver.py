from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional, Set, Tuple

from .slot_extractor import CrossConstraint, Slot
from .word_list import WordList

_TIMEOUT_SECONDS = 5.0  # per template attempt

logger = logging.getLogger(__name__)

Assignment = Dict[Slot, str]


# ─── Pattern helpers ──────────────────────────────────────────────────────────

def _get_pattern(slot: Slot, assignment: Assignment) -> List[Optional[str]]:
    """
    Build the letter pattern for this slot given the current partial assignment.
    Positions constrained by an already-assigned crossing slot get fixed letters;
    unconstrained positions are None (wildcard).
    """
    pattern: List[Optional[str]] = [None] * slot.length
    for pos, cell in enumerate(slot.cells):
        if pattern[pos] is not None:
            continue  # already constrained
        # Check every assigned slot to see if it covers this cell
        for assigned_slot, word in assignment.items():
            if cell in assigned_slot.cells:
                idx = assigned_slot.cells.index(cell)
                pattern[pos] = word[idx]
                break
    return pattern


# ─── CSP core ─────────────────────────────────────────────────────────────────

def _is_consistent(
    word: str,
    slot: Slot,
    assignment: Assignment,
    constraints: Dict[Slot, List[CrossConstraint]],
) -> bool:
    """
    Return True iff placing `word` in `slot` doesn't conflict with any
    letter already committed by an assigned crossing slot.
    """
    for c in constraints[slot]:
        other = c.slot_b if c.slot_a is slot else c.slot_a
        my_pos = c.pos_a if c.slot_a is slot else c.pos_b
        other_pos = c.pos_b if c.slot_a is slot else c.pos_a

        if other in assignment:
            if word[my_pos] != assignment[other][other_pos]:
                return False
    return True


def _forward_check(
    word: str,
    slot: Slot,
    assignment: Assignment,
    constraints: Dict[Slot, List[CrossConstraint]],
    word_list: WordList,
    theme_words: Set[str],
) -> bool:
    """
    After tentatively assigning `word` to `slot`, check that every
    unassigned neighbor still has at least one valid candidate.
    Returns False if any neighbor's domain is wiped out.
    """
    for c in constraints[slot]:
        neighbor = c.slot_b if c.slot_a is slot else c.slot_a
        if neighbor in assignment:
            continue
        pattern = _get_pattern(neighbor, assignment)
        if not word_list.get_candidates(pattern, theme_words):
            return False
    return True


def _mrv_select(
    unassigned: List[Slot],
    assignment: Assignment,
    word_list: WordList,
    theme_words: Set[str],
) -> Slot:
    """
    Minimum Remaining Values: pick the unassigned slot with the
    fewest valid words remaining in its domain.
    Ties broken by which slot has more constraints (degree heuristic).
    """
    def domain_size(slot: Slot) -> int:
        pattern = _get_pattern(slot, assignment)
        return len(word_list.get_candidates(pattern, theme_words))

    return min(unassigned, key=domain_size)


def _backtrack(
    assignment: Assignment,
    remaining: List[Slot],
    constraints: Dict[Slot, List[CrossConstraint]],
    word_list: WordList,
    theme_words: Set[str],
    min_theme_words: int,
    used_words: Set[str],
    deadline: float,
) -> Optional[Assignment]:
    if time.monotonic() > deadline:
        return None  # timed out — caller retries with next template

    if not remaining:
        theme_count = sum(1 for w in assignment.values() if w in theme_words)
        if theme_count < min_theme_words:
            return None
        return dict(assignment)

    slot = _mrv_select(remaining, assignment, word_list, theme_words)
    remaining_next = [s for s in remaining if s is not slot]

    pattern = _get_pattern(slot, assignment)
    candidates = word_list.get_candidates(pattern, theme_words)

    for word in candidates:
        if time.monotonic() > deadline:
            return None
        if word in used_words:
            continue  # no duplicate words in same puzzle
        if not _is_consistent(word, slot, assignment, constraints):
            continue

        assignment[slot] = word
        used_words.add(word)

        if _forward_check(word, slot, assignment, constraints, word_list, theme_words):
            result = _backtrack(
                assignment, remaining_next, constraints,
                word_list, theme_words, min_theme_words, used_words, deadline,
            )
            if result is not None:
                return result

        del assignment[slot]
        used_words.discard(word)

    return None  # dead end — backtrack


# ─── Public API ───────────────────────────────────────────────────────────────

def solve(
    slots: List[Slot],
    constraints: Dict[Slot, List[CrossConstraint]],
    word_list: WordList,
    theme_words: Optional[Set[str]] = None,
    min_theme_words: int = 1,
) -> Optional[Assignment]:
    """
    Run the CSP backtracking solver.

    Returns a complete assignment (slot → word) if solvable,
    or None if no solution exists with the given word list and theme words.

    Guarantees:
    - Every word in the assignment is in word_list
    - All cross-letter constraints are satisfied
    - No word appears twice in the same puzzle
    - At least min_theme_words slots contain a theme word
    """
    tw = theme_words or set()
    deadline = time.monotonic() + _TIMEOUT_SECONDS
    result = _backtrack(
        assignment={},
        remaining=list(slots),
        constraints=constraints,
        word_list=word_list,
        theme_words=tw,
        min_theme_words=min_theme_words,
        used_words=set(),
        deadline=deadline,
    )
    if result is None:
        logger.debug(
            "CSP found no solution for %d slots with %d theme words (min=%d)",
            len(slots), len(tw), min_theme_words,
        )
    return result
