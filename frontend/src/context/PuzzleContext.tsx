import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Puzzle, Cell, ClueInfo, Selection } from '../types/puzzle';
import { buildGrid, buildClueMap } from '../utils/gridUtils';

// State interface
interface PuzzleState {
  puzzle: Puzzle | null;
  puzzleId: string | null;
  grid: Cell[][] | null;
  clueMap: Map<string, ClueInfo> | null;
  userGrid: Map<string, string>;  // "row,col" -> letter
  selection: Selection | null;
  highlightedCells: Set<string>;  // "row,col"
  checkedCells: Map<string, boolean>;  // "row,col" -> isCorrect
  elapsedSeconds: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

// Action types
type PuzzleAction =
  | { type: 'SET_PUZZLE'; payload: { puzzle: Puzzle; puzzleId: string } }
  | { type: 'SET_CELL_VALUE'; payload: { row: number; col: number; value: string } }
  | { type: 'SET_SELECTION'; payload: Selection | null }
  | { type: 'SET_HIGHLIGHTED_CELLS'; payload: Set<string> }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'CHECK_CELL'; payload: { row: number; col: number; isCorrect: boolean } }
  | { type: 'CLEAR_CHECKS' }
  | { type: 'SET_COMPLETE'; payload: boolean }
  | { type: 'INCREMENT_TIMER' }
  | { type: 'RESET_TIMER' }
  | { type: 'CLEAR_GRID' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// Initial state
const initialState: PuzzleState = {
  puzzle: null,
  puzzleId: null,
  grid: null,
  clueMap: null,
  userGrid: new Map(),
  selection: null,
  highlightedCells: new Set(),
  checkedCells: new Map(),
  elapsedSeconds: 0,
  isComplete: false,
  isLoading: false,
  error: null,
};

// Reducer
function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  switch (action.type) {
    case 'SET_PUZZLE': {
      const { puzzle, puzzleId } = action.payload;
      const grid = buildGrid(puzzle);
      const clueMap = buildClueMap(puzzle);

      // Load saved user grid from localStorage
      const savedUserGrid = localStorage.getItem(`puzzle-${puzzleId}`);
      const userGrid = savedUserGrid ? new Map(JSON.parse(savedUserGrid)) : new Map();

      // Load saved time
      const savedTime = localStorage.getItem(`puzzle-time-${puzzleId}`);
      const elapsedSeconds = savedTime ? parseInt(savedTime, 10) : 0;

      // Auto-select first cell (0,0) with across direction
      const firstClue = Array.from(clueMap.values()).find(c => c.direction === 'across');
      const initialSelection: Selection | null = firstClue && firstClue.cells.length > 0
        ? {
            row: firstClue.cells[0].row,
            col: firstClue.cells[0].col,
            direction: 'across',
            clueNumber: firstClue.number,
          }
        : null;

      // Highlight first word
      const initialHighlighted: Set<string> = firstClue
        ? new Set(firstClue.cells.map(c => `${c.row},${c.col}`))
        : new Set<string>();

      return {
        ...state,
        puzzle,
        puzzleId,
        grid,
        clueMap,
        userGrid,
        elapsedSeconds,
        selection: initialSelection,
        highlightedCells: initialHighlighted,
        isLoading: false,
        error: null,
      };
    }

    case 'SET_CELL_VALUE': {
      const { row, col, value } = action.payload;
      const key = `${row},${col}`;
      const newUserGrid = new Map(state.userGrid);

      if (value === '') {
        newUserGrid.delete(key);
      } else {
        newUserGrid.set(key, value.toUpperCase());
      }

      // Save to localStorage
      if (state.puzzleId) {
        localStorage.setItem(
          `puzzle-${state.puzzleId}`,
          JSON.stringify(Array.from(newUserGrid.entries()))
        );
      }

      return { ...state, userGrid: newUserGrid };
    }

    case 'SET_SELECTION': {
      return { ...state, selection: action.payload };
    }

    case 'SET_HIGHLIGHTED_CELLS': {
      return { ...state, highlightedCells: action.payload };
    }

    case 'TOGGLE_DIRECTION': {
      if (!state.selection) return state;

      return {
        ...state,
        selection: {
          ...state.selection,
          direction: state.selection.direction === 'across' ? 'down' : 'across',
        },
      };
    }

    case 'CHECK_CELL': {
      const { row, col, isCorrect } = action.payload;
      const key = `${row},${col}`;
      const newCheckedCells = new Map(state.checkedCells);
      newCheckedCells.set(key, isCorrect);
      return { ...state, checkedCells: newCheckedCells };
    }

    case 'CLEAR_CHECKS': {
      return { ...state, checkedCells: new Map() };
    }

    case 'SET_COMPLETE': {
      return { ...state, isComplete: action.payload };
    }

    case 'INCREMENT_TIMER': {
      const newTime = state.elapsedSeconds + 1;

      // Save to localStorage
      if (state.puzzleId) {
        localStorage.setItem(`puzzle-time-${state.puzzleId}`, newTime.toString());
      }

      return { ...state, elapsedSeconds: newTime };
    }

    case 'RESET_TIMER': {
      if (state.puzzleId) {
        localStorage.removeItem(`puzzle-time-${state.puzzleId}`);
      }
      return { ...state, elapsedSeconds: 0 };
    }

    case 'CLEAR_GRID': {
      if (state.puzzleId) {
        localStorage.removeItem(`puzzle-${state.puzzleId}`);
      }
      return {
        ...state,
        userGrid: new Map(),
        checkedCells: new Map(),
        isComplete: false,
      };
    }

    case 'SET_LOADING': {
      return { ...state, isLoading: action.payload };
    }

    case 'SET_ERROR': {
      return { ...state, error: action.payload, isLoading: false };
    }

    default:
      return state;
  }
}

// Context
interface PuzzleContextType {
  state: PuzzleState;
  dispatch: React.Dispatch<PuzzleAction>;
}

const PuzzleContext = createContext<PuzzleContextType | undefined>(undefined);

// Provider
export function PuzzleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(puzzleReducer, initialState);

  // Timer effect
  useEffect(() => {
    if (state.puzzle && !state.isComplete) {
      const timer = setInterval(() => {
        dispatch({ type: 'INCREMENT_TIMER' });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state.puzzle, state.isComplete]);

  return (
    <PuzzleContext.Provider value={{ state, dispatch }}>
      {children}
    </PuzzleContext.Provider>
  );
}

// Hook to use puzzle context
export function usePuzzle() {
  const context = useContext(PuzzleContext);
  if (!context) {
    throw new Error('usePuzzle must be used within PuzzleProvider');
  }
  return context;
}
