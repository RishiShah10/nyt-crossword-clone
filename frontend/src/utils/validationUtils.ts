import type { Puzzle } from '../types/puzzle';

/**
 * Check if user's answers are correct
 */
export function validatePuzzle(
  puzzle: Puzzle,
  userGrid: Map<string, string>,
  pencilCells?: Set<string>
): {
  isComplete: boolean;
  isAllCorrect: boolean;
  incorrectCells: Set<string>;
} {
  const { rows, cols } = puzzle.size;
  const incorrectCells = new Set<string>();
  let filledCells = 0;
  let totalWhiteCells = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const correctLetter = puzzle.grid[index];

      // Skip black squares
      if (correctLetter === '.') continue;

      totalWhiteCells++;
      const cellKey = `${row},${col}`;
      const userLetter = userGrid.get(cellKey) || '';

      // Pencil cells don't count as filled and aren't checked
      if (pencilCells?.has(cellKey)) continue;

      if (userLetter) {
        filledCells++;
        if (userLetter.toUpperCase() !== correctLetter.toUpperCase()) {
          incorrectCells.add(cellKey);
        }
      }
    }
  }

  const isComplete = filledCells === totalWhiteCells;
  const isAllCorrect = incorrectCells.size === 0 && isComplete;

  return {
    isComplete,
    isAllCorrect,
    incorrectCells,
  };
}

/**
 * Check if a specific cell is correct
 */
export function validateCell(
  puzzle: Puzzle,
  row: number,
  col: number,
  userLetter: string
): boolean {
  const { cols } = puzzle.size;
  const index = row * cols + col;
  const correctLetter = puzzle.grid[index];

  if (correctLetter === '.') return false;

  return userLetter.toUpperCase() === correctLetter.toUpperCase();
}

/**
 * Get the correct letter for a cell
 */
export function getCorrectLetter(puzzle: Puzzle, row: number, col: number): string {
  const { cols } = puzzle.size;
  const index = row * cols + col;
  return puzzle.grid[index];
}

/**
 * Reveal all answers in the puzzle
 */
export function revealAllAnswers(puzzle: Puzzle): Map<string, string> {
  const { rows, cols } = puzzle.size;
  const revealedGrid = new Map<string, string>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const letter = puzzle.grid[index];

      if (letter !== '.') {
        revealedGrid.set(`${row},${col}`, letter);
      }
    }
  }

  return revealedGrid;
}
