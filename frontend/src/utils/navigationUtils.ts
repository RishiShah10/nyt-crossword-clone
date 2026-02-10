import type { Cell, ClueInfo } from '../types/puzzle';
import { getClueKeyForCell, getCellsForClue, getAdjacentCell } from './gridUtils';

/**
 * Navigate to the next word in the given direction
 */
export function getNextWord(
  grid: Cell[][],
  currentRow: number,
  currentCol: number,
  direction: 'across' | 'down',
  clueMap: Map<string, ClueInfo>
): { row: number; col: number; direction: 'across' | 'down' } | null {
  const clues = Array.from(clueMap.values()).filter(c => c.direction === direction);
  const currentClueKey = getClueKeyForCell(grid, currentRow, currentCol, direction, clueMap);

  if (!currentClueKey) {
    // If not in a valid clue, find first clue
    const firstClue = clues[0];
    if (firstClue && firstClue.cells.length > 0) {
      return { ...firstClue.cells[0], direction };
    }
    return null;
  }

  // Find current clue index
  const currentIndex = clues.findIndex(c => `${c.number}-${c.direction}` === currentClueKey);

  if (currentIndex === -1) return null;

  // Get next clue (wrap around)
  const nextIndex = (currentIndex + 1) % clues.length;
  const nextClue = clues[nextIndex];

  if (nextClue && nextClue.cells.length > 0) {
    return { ...nextClue.cells[0], direction };
  }

  return null;
}

/**
 * Navigate to the previous word in the given direction
 */
export function getPreviousWord(
  grid: Cell[][],
  currentRow: number,
  currentCol: number,
  direction: 'across' | 'down',
  clueMap: Map<string, ClueInfo>
): { row: number; col: number; direction: 'across' | 'down' } | null {
  const clues = Array.from(clueMap.values()).filter(c => c.direction === direction);
  const currentClueKey = getClueKeyForCell(grid, currentRow, currentCol, direction, clueMap);

  if (!currentClueKey) {
    // If not in a valid clue, find last clue
    const lastClue = clues[clues.length - 1];
    if (lastClue && lastClue.cells.length > 0) {
      return { ...lastClue.cells[0], direction };
    }
    return null;
  }

  // Find current clue index
  const currentIndex = clues.findIndex(c => `${c.number}-${c.direction}` === currentClueKey);

  if (currentIndex === -1) return null;

  // Get previous clue (wrap around)
  const prevIndex = currentIndex === 0 ? clues.length - 1 : currentIndex - 1;
  const prevClue = clues[prevIndex];

  if (prevClue && prevClue.cells.length > 0) {
    return { ...prevClue.cells[0], direction };
  }

  return null;
}

/**
 * Get the next cell in the current word, or move to next word if at end
 */
export function getNextCellInWordOrNextWord(
  grid: Cell[][],
  currentRow: number,
  currentCol: number,
  direction: 'across' | 'down',
  clueMap: Map<string, ClueInfo>
): { row: number; col: number; direction: 'across' | 'down' } | null {
  const clueKey = getClueKeyForCell(grid, currentRow, currentCol, direction, clueMap);
  if (!clueKey) return null;

  const cells = getCellsForClue(clueKey, clueMap);
  const currentIndex = cells.findIndex(c => c.row === currentRow && c.col === currentCol);

  if (currentIndex >= 0 && currentIndex < cells.length - 1) {
    // Move to next cell in word
    return { ...cells[currentIndex + 1], direction };
  } else {
    // Move to next word
    return getNextWord(grid, currentRow, currentCol, direction, clueMap);
  }
}

/**
 * Get the previous cell in the current word, or move to previous word if at start
 */
export function getPreviousCellInWordOrPreviousWord(
  grid: Cell[][],
  currentRow: number,
  currentCol: number,
  direction: 'across' | 'down',
  clueMap: Map<string, ClueInfo>
): { row: number; col: number; direction: 'across' | 'down' } | null {
  const clueKey = getClueKeyForCell(grid, currentRow, currentCol, direction, clueMap);
  if (!clueKey) return null;

  const cells = getCellsForClue(clueKey, clueMap);
  const currentIndex = cells.findIndex(c => c.row === currentRow && c.col === currentCol);

  if (currentIndex > 0) {
    // Move to previous cell in word
    return { ...cells[currentIndex - 1], direction };
  } else {
    // Move to previous word
    const prevWord = getPreviousWord(grid, currentRow, currentCol, direction, clueMap);
    if (prevWord) {
      // Go to the last cell of the previous word
      const prevClueKey = getClueKeyForCell(grid, prevWord.row, prevWord.col, direction, clueMap);
      if (prevClueKey) {
        const prevCells = getCellsForClue(prevClueKey, clueMap);
        if (prevCells.length > 0) {
          return { ...prevCells[prevCells.length - 1], direction };
        }
      }
    }
  }

  return null;
}

/**
 * Handle arrow key navigation
 */
export function handleArrowKey(
  grid: Cell[][],
  currentRow: number,
  currentCol: number,
  direction: 'across' | 'down',
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
): { row: number; col: number; direction?: 'across' | 'down' } | null {
  let deltaRow = 0;
  let deltaCol = 0;
  let newDirection = direction;

  switch (key) {
    case 'ArrowUp':
      deltaRow = -1;
      newDirection = 'down';
      break;
    case 'ArrowDown':
      deltaRow = 1;
      newDirection = 'down';
      break;
    case 'ArrowLeft':
      deltaCol = -1;
      newDirection = 'across';
      break;
    case 'ArrowRight':
      deltaCol = 1;
      newDirection = 'across';
      break;
  }

  const adjacent = getAdjacentCell(grid, currentRow, currentCol, deltaRow, deltaCol);
  if (adjacent) {
    return { ...adjacent, direction: newDirection };
  }

  return null;
}
