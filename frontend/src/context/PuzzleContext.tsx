import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Puzzle, Cell, ClueInfo, Selection } from '../types/puzzle';
import { buildGrid, buildClueMap } from '../utils/gridUtils';
import SavesManager from '../utils/savesManager';
import { throttle } from '../utils/debounce';

// Collaborative dispatch callback type
type CollaborativeDispatchFn = (action: { type: string; payload?: unknown }) => void;

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
  pencilCells: Set<string>;  // "row,col" — cells entered in pencil mode
  isPencilMode: boolean;
  elapsedSeconds: number;
  isComplete: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  // Collaborative room fields
  isCollaborative: boolean;
  collaborativeDispatch: CollaborativeDispatchFn | null;
  roomTimerData: { accumulatedSeconds: number; timerStartedAt: string | null; isPaused: boolean } | null;
}

// Action types
type PuzzleAction =
  | { type: 'SET_PUZZLE'; payload: { puzzle: Puzzle; puzzleId: string; _skipLocalSave?: boolean } }
  | { type: 'SET_CELL_VALUE'; payload: { row: number; col: number; value: string; _fromRemote?: boolean; _forceCommit?: boolean } }
  | { type: 'SET_SELECTION'; payload: Selection | null }
  | { type: 'SET_HIGHLIGHTED_CELLS'; payload: Set<string> }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'CHECK_CELL'; payload: { row: number; col: number; isCorrect: boolean; _fromRemote?: boolean } }
  | { type: 'CLEAR_CHECKS'; _fromRemote?: boolean }
  | { type: 'SET_COMPLETE'; payload: boolean; _fromRemote?: boolean }
  | { type: 'INCREMENT_TIMER' }
  | { type: 'RESET_TIMER' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'CLEAR_GRID' }
  | { type: 'TOGGLE_PENCIL' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COLLABORATIVE'; payload: { isCollaborative: boolean; collaborativeDispatch?: CollaborativeDispatchFn; roomTimerData?: { accumulatedSeconds: number; timerStartedAt: string | null; isPaused: boolean } } }
  | { type: 'SET_ROOM_TIMER'; payload: { isPaused: boolean; accumulatedSeconds: number; timerStartedAt: string | null } }
  | { type: 'LOAD_ROOM_STATE'; payload: { userGrid: [string, string][]; checkedCells: [string, boolean][]; accumulatedSeconds: number; isComplete: boolean } };

// Throttled save for timer updates (every 10 seconds)
const throttledTimerSave = throttle(
  (
    puzzleId: string,
    userGrid: Map<string, string>,
    checkedCells: Map<string, boolean>,
    elapsedSeconds: number,
    isComplete: boolean,
    puzzle: Puzzle,
    pencilCells?: Set<string>
  ) => {
    SavesManager.savePuzzleProgress(puzzleId, userGrid, checkedCells, elapsedSeconds, isComplete, puzzle, pencilCells);
  },
  10000 // 10 seconds
);

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
  pencilCells: new Set(),
  isPencilMode: false,
  elapsedSeconds: 0,
  isComplete: false,
  isPaused: false,
  isLoading: false,
  error: null,
  isCollaborative: false,
  collaborativeDispatch: null,
  roomTimerData: null,
};

// Reducer
function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  switch (action.type) {
    case 'SET_PUZZLE': {
      const { puzzle, puzzleId, _skipLocalSave } = action.payload;
      const grid = buildGrid(puzzle);
      const clueMap = buildClueMap(puzzle);

      let userGrid = new Map<string, string>();
      let checkedCells = new Map<string, boolean>();
      let pencilCells = new Set<string>();
      let elapsedSeconds = 0;
      let isComplete = false;

      // In room mode, skip local saves — room state comes from the server
      if (!_skipLocalSave) {
        try {
          // Try loading from new format
          const saveData = SavesManager.loadPuzzleProgress(puzzleId);

          if (saveData) {
            userGrid = new Map(saveData.userGrid);
            checkedCells = new Map(saveData.checkedCells);
            if (saveData.pencilCells) {
              pencilCells = new Set(saveData.pencilCells);
            }
            elapsedSeconds = saveData.elapsedSeconds;
            isComplete = saveData.isComplete;
          } else {
            // Try migrating from old format
            const migrated = SavesManager.migrateOldSaveWithPuzzle(puzzleId, puzzle);
            if (migrated) {
              const migratedData = SavesManager.loadPuzzleProgress(puzzleId);
              if (migratedData) {
                userGrid = new Map(migratedData.userGrid);
                checkedCells = new Map(migratedData.checkedCells);
                elapsedSeconds = migratedData.elapsedSeconds;
                isComplete = migratedData.isComplete;
              }
            }
          }
        } catch (error) {
          console.error('Error loading puzzle progress:', error);
          // Start fresh on error
        }
      }

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
        checkedCells,
        pencilCells,
        isPencilMode: false,
        elapsedSeconds,
        isComplete,
        selection: initialSelection,
        highlightedCells: initialHighlighted,
        isLoading: false,
        error: null,
      };
    }

    case 'SET_CELL_VALUE': {
      const { row, col, value, _fromRemote, _forceCommit } = action.payload;
      const key = `${row},${col}`;
      const newUserGrid = new Map(state.userGrid);
      const newPencilCells = new Set(state.pencilCells);

      if (value === '') {
        newUserGrid.delete(key);
        newPencilCells.delete(key);
      } else {
        newUserGrid.set(key, value.toUpperCase());
        if (_forceCommit) {
          // Reveals and other forced writes always commit (non-pencil)
          newPencilCells.delete(key);
        } else if (state.isPencilMode && !_fromRemote) {
          newPencilCells.add(key);
        } else if (!_fromRemote) {
          newPencilCells.delete(key);
        }
      }

      // In collaborative mode, broadcast the edit (skip if this came from a remote user)
      if (!_fromRemote && state.isCollaborative && state.collaborativeDispatch) {
        state.collaborativeDispatch({ type: 'SET_CELL_VALUE', payload: { row, col, value } });
      }

      // Debounced save to localStorage (skip in collaborative mode — room persists state)
      if (!state.isCollaborative && state.puzzleId && state.puzzle) {
        SavesManager.debouncedSaveProgress(
          state.puzzleId,
          newUserGrid,
          state.checkedCells,
          state.elapsedSeconds,
          state.isComplete,
          state.puzzle,
          newPencilCells
        );
      }

      // Auto-resume timer when typing
      return { ...state, userGrid: newUserGrid, pencilCells: newPencilCells, isPaused: false };
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
      const { row, col, isCorrect, _fromRemote } = action.payload;
      const key = `${row},${col}`;
      const newCheckedCells = new Map(state.checkedCells);
      newCheckedCells.set(key, isCorrect);

      // Broadcast in collaborative mode (skip if from remote)
      if (!_fromRemote && state.isCollaborative && state.collaborativeDispatch) {
        state.collaborativeDispatch({ type: 'CHECK_CELL', payload: { row, col, isCorrect } });
      }

      // Save checked cells immediately (skip in collaborative mode)
      if (!state.isCollaborative && state.puzzleId && state.puzzle) {
        SavesManager.savePuzzleProgress(
          state.puzzleId,
          state.userGrid,
          newCheckedCells,
          state.elapsedSeconds,
          state.isComplete,
          state.puzzle
        );
      }

      return { ...state, checkedCells: newCheckedCells };
    }

    case 'CLEAR_CHECKS': {
      const newCheckedCells = new Map<string, boolean>();

      // Broadcast in collaborative mode (skip if from remote)
      if (!action._fromRemote && state.isCollaborative && state.collaborativeDispatch) {
        state.collaborativeDispatch({ type: 'CLEAR_CHECKS' });
      }

      // Save immediately (skip in collaborative mode)
      if (!state.isCollaborative && state.puzzleId && state.puzzle) {
        SavesManager.savePuzzleProgress(
          state.puzzleId,
          state.userGrid,
          newCheckedCells,
          state.elapsedSeconds,
          state.isComplete,
          state.puzzle
        );
      }

      return { ...state, checkedCells: newCheckedCells };
    }

    case 'SET_COMPLETE': {
      const newIsComplete = action.payload;

      // Broadcast in collaborative mode (skip if from remote)
      if (!action._fromRemote && state.isCollaborative && state.collaborativeDispatch) {
        state.collaborativeDispatch({ type: 'SET_COMPLETE', payload: newIsComplete });
      }

      // Save immediately on completion (skip in collaborative mode)
      if (!state.isCollaborative && state.puzzleId && state.puzzle) {
        SavesManager.savePuzzleProgress(
          state.puzzleId,
          state.userGrid,
          state.checkedCells,
          state.elapsedSeconds,
          newIsComplete,
          state.puzzle
        );
      }

      return { ...state, isComplete: newIsComplete };
    }

    case 'INCREMENT_TIMER': {
      const newTime = state.elapsedSeconds + 1;

      // Throttled save to localStorage (every 10 seconds)
      if (state.puzzleId && state.puzzle) {
        throttledTimerSave(
          state.puzzleId,
          state.userGrid,
          state.checkedCells,
          newTime,
          state.isComplete,
          state.puzzle,
          state.pencilCells
        );
      }

      return { ...state, elapsedSeconds: newTime };
    }

    case 'RESET_TIMER': {
      // Save with reset time
      if (state.puzzleId && state.puzzle) {
        SavesManager.savePuzzleProgress(
          state.puzzleId,
          state.userGrid,
          state.checkedCells,
          0,
          state.isComplete,
          state.puzzle
        );
      }
      return { ...state, elapsedSeconds: 0 };
    }

    case 'TOGGLE_PAUSE': {
      return { ...state, isPaused: !state.isPaused };
    }

    case 'CLEAR_GRID': {
      // Delete the save from SavesManager
      if (state.puzzleId) {
        SavesManager.deleteSave(state.puzzleId);
      }
      return {
        ...state,
        userGrid: new Map(),
        checkedCells: new Map(),
        pencilCells: new Set(),
        isComplete: false,
      };
    }

    case 'TOGGLE_PENCIL': {
      return { ...state, isPencilMode: !state.isPencilMode };
    }

    case 'SET_LOADING': {
      return { ...state, isLoading: action.payload };
    }

    case 'SET_ERROR': {
      return { ...state, error: action.payload, isLoading: false };
    }

    case 'SET_COLLABORATIVE': {
      const { isCollaborative, collaborativeDispatch, roomTimerData } = action.payload;
      return {
        ...state,
        isCollaborative,
        collaborativeDispatch: collaborativeDispatch ?? null,
        roomTimerData: roomTimerData ?? null,
      };
    }

    case 'SET_ROOM_TIMER': {
      const { isPaused, accumulatedSeconds, timerStartedAt } = action.payload;
      // Compute current elapsed from room timer data
      let elapsed = accumulatedSeconds;
      if (!isPaused && timerStartedAt) {
        const started = new Date(timerStartedAt).getTime();
        elapsed += Math.floor((Date.now() - started) / 1000);
      }
      return {
        ...state,
        isPaused,
        elapsedSeconds: elapsed,
        roomTimerData: { accumulatedSeconds, timerStartedAt, isPaused },
      };
    }

    case 'LOAD_ROOM_STATE': {
      const { userGrid, checkedCells, accumulatedSeconds, isComplete } = action.payload;
      return {
        ...state,
        userGrid: new Map(userGrid),
        checkedCells: new Map(checkedCells),
        elapsedSeconds: accumulatedSeconds,
        isComplete,
      };
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

  // Run migration check on mount
  useEffect(() => {
    SavesManager.migrateAllOldSaves();
  }, []);

  // Timer effect
  useEffect(() => {
    if (state.puzzle && !state.isComplete && !state.isPaused) {
      if (state.isCollaborative && state.roomTimerData) {
        // Collaborative mode: compute elapsed from room timer data each tick
        const timer = setInterval(() => {
          const rtd = state.roomTimerData!;
          let elapsed = rtd.accumulatedSeconds;
          if (!rtd.isPaused && rtd.timerStartedAt) {
            const started = new Date(rtd.timerStartedAt).getTime();
            elapsed += Math.floor((Date.now() - started) / 1000);
          }
          // Directly set via INCREMENT_TIMER equivalent but we just recompute
          dispatch({ type: 'INCREMENT_TIMER' });
        }, 1000);
        return () => clearInterval(timer);
      } else {
        // Single-player mode: simple increment
        const timer = setInterval(() => {
          dispatch({ type: 'INCREMENT_TIMER' });
        }, 1000);
        return () => clearInterval(timer);
      }
    }
  }, [state.puzzle, state.isComplete, state.isPaused, state.isCollaborative, state.roomTimerData]);

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
