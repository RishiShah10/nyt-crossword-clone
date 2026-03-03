# Crossword Generation Engine — Architecture & Design

## Problem Statement

The current generation flow delegates all structural decisions to an LLM (GPT-4o):

1. LLM constructs grid + answers + clues in one pass
2. Post-processing re-derives grid numbering
3. Grid length is validated (25 cells)
4. No deterministic word solver is used

This produces puzzles that frequently fail:
- Down answers are not real words
- Cross letters are inconsistent between across and down entries
- Clues do not match answers
- Grid symmetry is violated
- Theme density is weak and unpredictable

---

## 1. Why Prompt Engineering Cannot Guarantee Structural Correctness

This is not a prompting problem. It is an architecture problem.

LLMs are autoregressive next-token predictors. They produce tokens sequentially,
left-to-right, with no backtracking and no global constraint satisfaction.

A crossword is a **constraint satisfaction problem (CSP)** with hard structural invariants:

- If `SPEED` is placed at 1-Across, cells `(0,0)–(0,4)` are fixed
- Every Down answer crossing those cells is now constrained at a specific letter position
- The LLM must simultaneously satisfy N such constraints while generating text
- It has no mechanism to verify them — attention is probabilistic, not a constraint store

By the time the LLM generates 3-Down, it has already committed to letters at `(0,2)`, `(1,2)`,
`(2,2)` from across entries. It may recall them approximately via attention, but there is no
enforcement. The output will be *plausible-looking*, not *provably correct*.

**Root cause:** crossword filling is NP-complete in general. The only correct solution is
combinatorial search with backtracking. Prompting an LLM to do combinatorial search is
asking it to sort a list by reasoning — it will produce something that resembles a solution,
not something that is one.

---

## 2. Specific Failure Modes

### F1 — Cross-letter inconsistency (most common)
LLM places `SPEED` across and `STONE` down, but at cell `(0,1)`, `SPEED` requires `P`
and `STONE` requires `T`. The grid array says `P` but the down answer says `T`.
Current validator only checks grid length — it does not verify cross-letter agreement.

### F2 — Invalid down entries
Down words are harder for the LLM to construct because they are read column-by-column,
not left-to-right. The model's training bias toward natural language order produces more
plausible across entries and lexically weaker down entries (`NREET`, `OPELD`, etc.).

### F3 — Gridnum assignment errors
If the LLM's `grid` array is structurally wrong (asymmetric black squares, orphaned cells),
gridnums computed in post-processing will be wrong even if the re-derivation logic is correct.

### F4 — Symmetry violations
180° rotational symmetry requires: if `grid[i]` is `'.'`, then `grid[24-i]` is also `'.'`
(for a 5×5, 25-cell grid). LLMs do not reliably maintain this.

### F5 — Disconnected / unchecked cells
A white cell with no horizontal neighbor and no vertical neighbor is unchecked.
Standard crossword rules prohibit these. Current validator does not detect them.

### F6 — Clue-answer mismatch
LLM may generate a clue for `CRANE` but fill the grid with `CRAKE`. Answer and clue
diverge because they are generated in the same pass without mutual grounding.

### F7 — Theme dilution
Structural pressure from fitting a 5×5 grid overrides theme selection.
LLM defaults to common 5-letter words satisfying length constraints.
Theme words appear in 1-2 slots out of 8-10, then disappear.

### F8 — Single-letter words
A black square adjacent to a grid border can create a 1-letter "word."
Current validator does not check minimum word length.

---

## 3. Production-Grade Requirements

| Property | Mechanism |
|---|---|
| All entries are real words | Deterministic word list lookup — never LLM |
| Cross letters match | CSP enforces this by construction |
| Grid symmetry | Enforced before word filling begins |
| Grid connectivity | BFS validation on template |
| No unchecked cells | Slot extraction rejects them |
| Minimum word length ≥ 3 | Template validation |
| Clues match answers | LLM receives confirmed answers, generates clues only |
| Theme density ≥ K words | Hard constraint in backtracking terminal |

---

## 4. Hybrid Architecture

```
┌─────────────────────────────────────────────────┐
│ Phase 1: Grid Template (deterministic)          │
│   - Load from precomputed valid template pool   │
│   - Select randomly based on constraints        │
└────────────────────┬────────────────────────────┘
                     │ valid symmetric grid
                     ▼
┌─────────────────────────────────────────────────┐
│ Phase 2: Slot Extraction (deterministic)        │
│   - Extract all Across/Down slots               │
│   - Build cross-constraint map                  │
│   - Reject if any word < 3 letters              │
└────────────────────┬────────────────────────────┘
                     │ slots + constraint graph
                     ▼
┌─────────────────────────────────────────────────┐
│ Phase 3: Word Filling — CSP Solver              │
│   - Backtracking with MRV + forward checking    │
│   - AC-3 arc consistency propagation            │
│   - Word trie for O(L) pattern lookup           │
│   - Theme words prioritized in value ordering   │
│   - Guaranteed: all words real, all crosses OK  │
└────────────────────┬────────────────────────────┘
                     │ solved grid with confirmed words
                     ▼
┌─────────────────────────────────────────────────┐
│ Phase 4: Clue Generation (LLM)                  │
│   - Input: confirmed word list + theme topics   │
│   - Output: one clue per confirmed word         │
│   - LLM has zero structural responsibility      │
└────────────────────┬────────────────────────────┘
                     │ complete puzzle
                     ▼
┌─────────────────────────────────────────────────┐
│ Phase 5: Final Validation (deterministic)       │
│   - Cross letters consistent                    │
│   - All answers in word list                    │
│   - Gridnums computed from scratch              │
│   - Puzzle accepted or retry from Phase 1       │
└─────────────────────────────────────────────────┘
```

**Key separation:** The LLM touches creativity. The solver owns correctness. These must never overlap.

---

## 5. Data Structures and Algorithms

### Trie — Word Pattern Lookup

Used to find all valid words matching a partial pattern (e.g., `S??ED` → `SPEED`, `STEED`, `SHRED`).

```
Time complexity: O(L × branching_factor^wildcards)
Space complexity: O(total_characters_in_word_list)
Much faster than linear scan on 180k words for pattern queries.
```

Insert once at startup. Query thousands of times during backtracking.

### CSP Variable Ordering — MRV (Minimum Remaining Values)

At each backtracking step, select the unassigned slot with the **fewest valid words**
in its current domain. This:
- Detects dead-ends early before wasting search on impossible branches
- Naturally focuses on the most constrained parts of the grid first

### CSP Value Ordering — Frequency + Theme Bonus

Within a slot's domain, order candidates by:
1. Theme words (highest priority)
2. Word frequency from corpus (common words are more crossword-friendly)
3. Alphabetical as tiebreaker

### Arc Consistency — AC-3

Before and during backtracking, propagate constraints:
- For each unassigned slot, check that every candidate value is arc-consistent
  with every neighboring slot's domain
- Prune candidates that can never lead to a valid solution
- If any slot's domain becomes empty, backtrack immediately

### Backtracking with Forward Checking

```
function backtrack(assignment, remaining_slots):
    if remaining_slots is empty:
        if theme_count(assignment) >= min_theme_words:
            return assignment
        return None  // fail — not enough theme words

    slot = MRV_select(remaining_slots)
    pattern = get_pattern(slot, assignment)
    candidates = word_list.get_candidates(pattern, theme_words)

    for word in candidates:
        if is_consistent(word, slot, assignment):
            assignment[slot] = word
            // Forward check: ensure no neighbor's domain becomes empty
            if all neighbors still have valid candidates:
                result = backtrack(assignment, remaining_slots - {slot})
                if result is not None:
                    return result
            del assignment[slot]

    return None  // backtrack
```

### Theme Density Enforcement

The LLM is used **once** as a thesaurus — not as a solver:

1. Send topics to LLM: "Give me 30 words (3-5 letters) associated with {topics}"
2. Filter returned words through the word list (must be valid dictionary words)
3. This becomes the `theme_words` set used in value ordering
4. `min_theme_words` is a hard constraint checked at the terminal node

This guarantees theme density without relying on the LLM to maintain it during grid filling.

---

## 6. File Structure

```
backend/
├── app/
│   ├── services/
│   │   ├── crossword/
│   │   │   ├── __init__.py
│   │   │   ├── word_list.py          # Trie + WordList class
│   │   │   ├── grid_template.py      # Template generation + validation
│   │   │   ├── slot_extractor.py     # Slot + CrossConstraint extraction
│   │   │   ├── csp_solver.py         # Backtracking solver with MRV + AC-3
│   │   │   ├── clue_generator.py     # LLM clue generation (confirmed answers only)
│   │   │   └── puzzle_builder.py     # Orchestrator pipeline
│   │   └── openai_service.py         # Updated to use puzzle_builder
│   └── api/
│       └── puzzles.py                # /generate endpoint (auth removed)
├── data/
│   ├── word_list.txt                 # Filtered English word list (3-5 letters)
│   └── valid_templates.json          # Precomputed valid 5x5 grid templates
└── scripts/
    └── build_crossword_data.py       # Run once: generates word list + templates
```

---

## 7. Implementation Plan

### Phase 1 — Offline Data Preparation
- [ ] Write `scripts/build_crossword_data.py`
  - Downloads `words_alpha.txt` (370k English words, public domain)
  - Filters to 3-5 letter words, alphabetic only
  - Saves to `data/word_list.txt`
  - Enumerates all valid 5×5 symmetric grids (2^13 search space, <1s)
  - Validates each: connectivity, symmetry, min word length, no unchecked cells
  - Saves ~200-400 valid templates to `data/valid_templates.json`

### Phase 2 — Core Engine
- [ ] `word_list.py` — Trie with `insert`, `search`, `words_matching(pattern)`
- [ ] `grid_template.py` — load templates from JSON, validate, sample
- [ ] `slot_extractor.py` — extract Across/Down slots, build constraint graph
- [ ] `csp_solver.py` — MRV selection, consistency check, AC-3, backtracking

### Phase 3 — LLM Integration
- [ ] `clue_generator.py` — send confirmed answers to OpenAI, return clue dict
- [ ] `puzzle_builder.py` — full pipeline orchestrator with retry logic
- [ ] Update `openai_service.py` to delegate to `puzzle_builder`

### Phase 4 — API & Frontend
- [ ] Remove auth requirement from `/generate` endpoint (rate limiting is sufficient)
- [ ] Update `GeneratePuzzleModal` — better loading state, error messages
- [ ] Add `OPENAI_API_KEY` to `.env`

---

## 8. What the LLM Does vs. What the Solver Does

| Responsibility | Owner |
|---|---|
| Grid layout (black squares) | Precomputed templates (deterministic) |
| Slot extraction | Code (deterministic) |
| Word filling | CSP backtracking solver (deterministic) |
| Cross-letter consistency | CSP by construction (deterministic) |
| Theme word expansion | LLM as thesaurus — output filtered through word list |
| Clue writing | LLM with confirmed answers only |
| Final validation | Code (deterministic) |

---

## 9. Performance Expectations

- Template loading: `< 1ms` (loaded at startup)
- Trie construction: `~200ms` at startup for 50k words
- CSP solving: `< 100ms` for most 5×5 grids with AC-3 + MRV
- Clue generation (LLM): `~2-5s` (single API call, all words batched)
- Total per puzzle: `~3-6s` wall time, dominated by LLM clue call

Worst case: CSP fails on current template (< 1% with good word list),
retries with new template. Max retries: 20. Timeout: 30s.
