import { useEffect } from 'react';
import { usePuzzle } from '../context/PuzzleContext';
import { useKeyboardActions } from './useKeyboardActions';
import {
  handleArrowKey,
} from '../utils/navigationUtils';
import { getClueKeyForCell, getCellsForClue } from '../utils/gridUtils';

export function useKeyboard() {
  const { state, dispatch } = usePuzzle();
  const { grid, clueMap, selection } = state;
  const actions = useKeyboardActions();

  useEffect(() => {
    if (!grid || !clueMap || !selection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in non-crossword inputs (e.g., Join Room code input)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const isGridCell = target.closest('[role="grid"]');
        if (!isGridCell) return;
      }

      const { row, col, direction } = selection;

      // Arrow keys - cell-by-cell navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const arrowDirection = (e.key === 'ArrowLeft' || e.key === 'ArrowRight') ? 'across' : 'down';
        const changingDirection = arrowDirection !== direction;

        let newRow = row;
        let newCol = col;
        let newDirection = direction;

        if (changingDirection) {
          // Only change direction, stay on same square
          newDirection = arrowDirection;
        } else {
          // Move in current direction
          const result = handleArrowKey(
            grid,
            row,
            col,
            direction,
            e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
          );
          if (!result) return;
          newRow = result.row;
          newCol = result.col;
          newDirection = result.direction || direction;
        }

        dispatch({
          type: 'SET_SELECTION',
          payload: { row: newRow, col: newCol, direction: newDirection, clueNumber: grid[newRow][newCol].number },
        });

        const clueKey = getClueKeyForCell(grid, newRow, newCol, newDirection, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
          dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
        }
        return;
      }

      // Tab - previous word, Shift+Tab - next word
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          actions.handleNextWord();
        } else {
          actions.handlePrevWord();
        }
        return;
      }

      // Space bar - toggle direction
      if (e.key === ' ') {
        e.preventDefault();
        actions.handleToggleDirection();
        return;
      }

      // Backspace - clear current cell and move to previous
      if (e.key === 'Backspace') {
        e.preventDefault();
        actions.handleBackspace();
        return;
      }

      // Delete - clear current cell without moving
      if (e.key === 'Delete') {
        e.preventDefault();
        dispatch({
          type: 'SET_CELL_VALUE',
          payload: { row, col, value: '' },
        });
        return;
      }

      // Enter - move to next clue
      if (e.key === 'Enter') {
        e.preventDefault();
        actions.handleNextWord();
        return;
      }

      // Home - go to first cell of current word
      if (e.key === 'Home') {
        e.preventDefault();
        const clueKey = getClueKeyForCell(grid, row, col, direction, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          if (cells.length > 0) {
            const firstCell = cells[0];
            dispatch({
              type: 'SET_SELECTION',
              payload: {
                row: firstCell.row,
                col: firstCell.col,
                direction,
                clueNumber: grid[firstCell.row][firstCell.col].number,
              },
            });
          }
        }
        return;
      }

      // End - go to last cell of current word
      if (e.key === 'End') {
        e.preventDefault();
        const clueKey = getClueKeyForCell(grid, row, col, direction, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          if (cells.length > 0) {
            const lastCell = cells[cells.length - 1];
            dispatch({
              type: 'SET_SELECTION',
              payload: {
                row: lastCell.row,
                col: lastCell.col,
                direction,
                clueNumber: grid[lastCell.row][lastCell.col].number,
              },
            });
          }
        }
        return;
      }

      // Period toggles pencil mode
      if (e.key === '.') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PENCIL' });
        return;
      }

      // Letter input - fill cell and advance
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        e.preventDefault();
        actions.handleLetter(e.key);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [grid, clueMap, selection, dispatch, actions]);
}
