import type { Puzzle, Cell, ClueInfo } from '../types/puzzle';

/**
 * Convert flat puzzle grid to 2D grid with cell metadata
 */
export function buildGrid(puzzle: Puzzle): Cell[][] {
  const { rows, cols } = puzzle.size;
  const grid2D: Cell[][] = [];

  for (let row = 0; row < rows; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const letter = puzzle.grid[index];
      const number = puzzle.gridnums[index] || null;
      const isCircled = false; // Disable circles for now
      const isShaded = false; // Disable shading for now

      rowCells.push({
        letter,
        number: number === 0 ? null : number,
        isBlack: letter === '.',
        row,
        col,
        isCircled,
        isShaded,
      });
    }
    grid2D.push(rowCells);
  }

  return grid2D;
}

/**
 * Build mapping of clue numbers to cell ranges and answers
 */
export function buildClueMap(puzzle: Puzzle): Map<string, ClueInfo> {
  const { rows, cols } = puzzle.size;
  const grid2D = buildGrid(puzzle);
  const clueMap = new Map<string, ClueInfo>();

  // Track which clue index we're on for across and down
  let acrossIndex = 0;
  let downIndex = 0;

  // Scan grid for numbered cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = grid2D[row][col];
      if (cell.isBlack || cell.number === null) continue;

      const clueNumber = cell.number;

      // Check if this starts an across word
      const startsAcross = col === 0 || grid2D[row][col - 1].isBlack;
      if (startsAcross && col < cols - 1 && !grid2D[row][col + 1].isBlack) {
        const cells: { row: number; col: number }[] = [];
        let c = col;
        while (c < cols && !grid2D[row][c].isBlack) {
          cells.push({ row, col: c });
          c++;
        }

        if (acrossIndex < puzzle.clues.across.length) {
          clueMap.set(`${clueNumber}-across`, {
            number: clueNumber,
            clue: puzzle.clues.across[acrossIndex],
            answer: puzzle.answers.across[acrossIndex],
            direction: 'across',
            cells,
          });
          acrossIndex++;
        }
      }

      // Check if this starts a down word
      const startsDown = row === 0 || grid2D[row - 1][col].isBlack;
      if (startsDown && row < rows - 1 && !grid2D[row + 1][col].isBlack) {
        const cells: { row: number; col: number }[] = [];
        let r = row;
        while (r < rows && !grid2D[r][col].isBlack) {
          cells.push({ row: r, col });
          r++;
        }

        if (downIndex < puzzle.clues.down.length) {
          clueMap.set(`${clueNumber}-down`, {
            number: clueNumber,
            clue: puzzle.clues.down[downIndex],
            answer: puzzle.answers.down[downIndex],
            direction: 'down',
            cells,
          });
          downIndex++;
        }
      }
    }
  }

  return clueMap;
}

/**
 * Get the clue key (e.g., "1-across") for a given cell and direction
 */
export function getClueKeyForCell(
  grid: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down',
  clueMap: Map<string, ClueInfo>
): string | null {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  if (grid[row][col].isBlack) return null;

  // Find the start of the word
  if (direction === 'across') {
    // Move left to find start
    while (col > 0 && !grid[row][col - 1].isBlack) {
      col--;
    }
  } else {
    // Move up to find start
    while (row > 0 && !grid[row - 1][col].isBlack) {
      row--;
    }
  }

  // Get the clue number at the start position
  const startCell = grid[row][col];
  if (startCell.number === null) return null;

  const clueKey = `${startCell.number}-${direction}`;
  return clueMap.has(clueKey) ? clueKey : null;
}

/**
 * Get all cells for a given clue
 */
export function getCellsForClue(clueKey: string, clueMap: Map<string, ClueInfo>): { row: number; col: number }[] {
  const clueInfo = clueMap.get(clueKey);
  return clueInfo ? clueInfo.cells : [];
}

/**
 * Get the next cell in a word given current cell and direction
 */
export function getNextCellInWord(
  grid: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down'
): { row: number; col: number } | null {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  if (direction === 'across') {
    const nextCol = col + 1;
    if (nextCol < cols && !grid[row][nextCol].isBlack) {
      return { row, col: nextCol };
    }
  } else {
    const nextRow = row + 1;
    if (nextRow < rows && !grid[nextRow][col].isBlack) {
      return { row: nextRow, col };
    }
  }

  return null;
}

/**
 * Get the previous cell in a word given current cell and direction
 */
export function getPreviousCellInWord(
  grid: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down'
): { row: number; col: number } | null {
  if (direction === 'across') {
    const prevCol = col - 1;
    if (prevCol >= 0 && !grid[row][prevCol].isBlack) {
      return { row, col: prevCol };
    }
  } else {
    const prevRow = row - 1;
    if (prevRow >= 0 && !grid[prevRow][col].isBlack) {
      return { row: prevRow, col };
    }
  }

  return null;
}

/**
 * Get the next cell when moving with arrow keys
 */
export function getAdjacentCell(
  grid: Cell[][],
  row: number,
  col: number,
  deltaRow: number,
  deltaCol: number
): { row: number; col: number } | null {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  let newRow = row + deltaRow;
  let newCol = col + deltaCol;

  // Skip black squares
  while (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
    if (!grid[newRow][newCol].isBlack) {
      return { row: newRow, col: newCol };
    }
    newRow += deltaRow;
    newCol += deltaCol;
  }

  return null;
}

/**
 * Check if a cell is part of a clue
 */
export function isCellInClue(
  row: number,
  col: number,
  clueKey: string,
  clueMap: Map<string, ClueInfo>
): boolean {
  const cells = getCellsForClue(clueKey, clueMap);
  return cells.some(cell => cell.row === row && cell.col === col);
}
