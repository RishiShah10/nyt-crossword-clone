// TypeScript types for crossword puzzle data

export interface PuzzleSize {
  rows: number;
  cols: number;
}

export interface Puzzle {
  size: PuzzleSize;
  grid: string[];  // Flat array of letters, '.' for black squares
  gridnums: number[];  // Clue numbers for each cell, 0 if no number
  clues: {
    across: string[];
    down: string[];
  };
  answers: {
    across: string[];
    down: string[];
  };
  author?: string;
  editor?: string;
  copyright?: string;
  publisher?: string;
  date?: string;
  dow?: string;  // Day of week
  title?: string;
  circles?: number[];
  shades?: number[];
  notepad?: string;
  jnotes?: string;
}

export interface PuzzleResponse {
  puzzle: Puzzle;
  puzzle_id: string;
}

// Grid cell with metadata
export interface Cell {
  letter: string;  // Current letter or '.' for black square
  number: number | null;  // Clue number if applicable
  isBlack: boolean;
  row: number;
  col: number;
  isCircled?: boolean;
  isShaded?: boolean;
}

// Clue with cell mapping
export interface ClueInfo {
  number: number;
  clue: string;
  answer: string;
  direction: 'across' | 'down';
  cells: { row: number; col: number }[];  // Cells this clue spans
}

// User's grid state
export interface UserGrid {
  [key: string]: string;  // Key: "row,col", Value: letter
}

// Selected cell/word state
export interface Selection {
  row: number;
  col: number;
  direction: 'across' | 'down';
  clueNumber: number | null;
}

// Validation results
export interface ValidationResult {
  isCorrect: boolean;
  incorrectCells: Set<string>;  // Keys: "row,col"
}
