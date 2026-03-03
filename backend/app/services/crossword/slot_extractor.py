from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .grid_template import GridTemplate, ROWS, COLS


@dataclass(frozen=True)
class Slot:
    """
    A single across or down word slot in the grid.

    Identified by (direction, start_row, start_col).
    cells: ordered list of (row, col) tuples the word occupies.
    """

    direction: str  # 'across' | 'down'
    start_row: int
    start_col: int
    length: int
    cells: Tuple[Tuple[int, int], ...] = field(compare=False, hash=False)

    def __repr__(self) -> str:
        end_r, end_c = self.cells[-1]
        return (
            f"Slot({self.direction} {self.start_row},{self.start_col}"
            f"→{end_r},{end_c} len={self.length})"
        )


@dataclass(frozen=True)
class CrossConstraint:
    """
    Encodes that slot_a[pos_a] == slot_b[pos_b] (they share a cell).
    """

    slot_a: Slot
    pos_a: int
    slot_b: Slot
    pos_b: int


def extract_slots(template: GridTemplate) -> List[Slot]:
    """Extract all Across and Down slots (length ≥ 2) from the template."""
    slots: List[Slot] = []
    grid = template.grid

    # Across
    for r in range(ROWS):
        c = 0
        while c < COLS:
            if not grid[r * COLS + c]:
                start = c
                cells = []
                while c < COLS and not grid[r * COLS + c]:
                    cells.append((r, c))
                    c += 1
                if len(cells) >= 2:
                    slots.append(
                        Slot("across", r, start, len(cells), tuple(cells))
                    )
            else:
                c += 1

    # Down
    for c in range(COLS):
        r = 0
        while r < ROWS:
            if not grid[r * COLS + c]:
                start = r
                cells = []
                while r < ROWS and not grid[r * COLS + c]:
                    cells.append((r, c))
                    r += 1
                if len(cells) >= 2:
                    slots.append(
                        Slot("down", start, c, len(cells), tuple(cells))
                    )
            else:
                r += 1

    return slots


def build_constraint_graph(
    slots: List[Slot],
) -> Dict[Slot, List[CrossConstraint]]:
    """
    For every pair of slots sharing a cell, record a CrossConstraint.
    Returns dict mapping each slot to the list of constraints it participates in.
    """
    # Build: cell → [(slot, position_in_slot), ...]
    cell_to_entries: Dict[Tuple[int, int], List[Tuple[Slot, int]]] = {}
    for slot in slots:
        for pos, cell in enumerate(slot.cells):
            cell_to_entries.setdefault(cell, []).append((slot, pos))

    constraints: Dict[Slot, List[CrossConstraint]] = {s: [] for s in slots}
    for cell, entries in cell_to_entries.items():
        if len(entries) == 2:
            (slot_a, pos_a), (slot_b, pos_b) = entries
            c = CrossConstraint(slot_a, pos_a, slot_b, pos_b)
            constraints[slot_a].append(c)
            constraints[slot_b].append(c)

    return constraints
