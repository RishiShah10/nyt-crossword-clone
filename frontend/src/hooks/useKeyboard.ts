import { useEffect } from 'react';
import { usePuzzle } from '../context/PuzzleContext';
import {
  handleArrowKey,
  getNextWord,
  getPreviousWord,
  getNextCellInWordOrNextWord,
  getPreviousCellInWordOrPreviousWord,
} from '../utils/navigationUtils';
import { getClueKeyForCell, getCellsForClue } from '../utils/gridUtils';

export function useKeyboard() {
  const { state, dispatch } = usePuzzle();
  const { grid, clueMap, selection, userGrid } = state;

  useEffect(() => {
    if (!grid || !clueMap || !selection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { row, col, direction } = selection;

      // Arrow keys - cell-by-cell navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const result = handleArrowKey(
          grid,
          row,
          col,
          direction,
          e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
        );

        if (result) {
          const newDirection = result.direction || direction;
          dispatch({
            type: 'SET_SELECTION',
            payload: {
              row: result.row,
              col: result.col,
              direction: newDirection,
              clueNumber: grid[result.row][result.col].number,
            },
          });

          // Update highlighted cells
          const clueKey = getClueKeyForCell(grid, result.row, result.col, newDirection, clueMap);
          if (clueKey) {
            const cells = getCellsForClue(clueKey, clueMap);
            const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
            dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
          }
        }
        return;
      }

      // Tab - next word, Shift+Tab - previous word
      if (e.key === 'Tab') {
        e.preventDefault();
        const result = e.shiftKey
          ? getPreviousWord(grid, row, col, direction, clueMap)
          : getNextWord(grid, row, col, direction, clueMap);

        if (result) {
          dispatch({
            type: 'SET_SELECTION',
            payload: {
              row: result.row,
              col: result.col,
              direction: result.direction,
              clueNumber: grid[result.row][result.col].number,
            },
          });

          // Update highlighted cells
          const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
          if (clueKey) {
            const cells = getCellsForClue(clueKey, clueMap);
            const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
            dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
          }
        }
        return;
      }

      // Space bar - toggle direction
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_DIRECTION' });

        // Update highlighted cells with new direction
        const newDirection = direction === 'across' ? 'down' : 'across';
        const clueKey = getClueKeyForCell(grid, row, col, newDirection, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
          dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
        }
        return;
      }

      // Backspace - clear current cell and move to previous
      if (e.key === 'Backspace') {
        e.preventDefault();
        const cellKey = `${row},${col}`;
        const currentValue = userGrid.get(cellKey) || '';

        if (currentValue) {
          // Clear current cell
          dispatch({
            type: 'SET_CELL_VALUE',
            payload: { row, col, value: '' },
          });
        } else {
          // Move to previous cell
          const result = getPreviousCellInWordOrPreviousWord(grid, row, col, direction, clueMap);
          if (result) {
            dispatch({
              type: 'SET_SELECTION',
              payload: {
                row: result.row,
                col: result.col,
                direction: result.direction,
                clueNumber: grid[result.row][result.col].number,
              },
            });

            // Clear the previous cell
            dispatch({
              type: 'SET_CELL_VALUE',
              payload: { row: result.row, col: result.col, value: '' },
            });

            // Update highlighted cells
            const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
            if (clueKey) {
              const cells = getCellsForClue(clueKey, clueMap);
              const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
              dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
            }
          }
        }
        return;
      }

      // Letter input - fill cell and advance
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        e.preventDefault();
        const letter = e.key.toUpperCase();

        // Set cell value
        dispatch({
          type: 'SET_CELL_VALUE',
          payload: { row, col, value: letter },
        });

        // Auto-advance to next cell
        const result = getNextCellInWordOrNextWord(grid, row, col, direction, clueMap);
        if (result) {
          dispatch({
            type: 'SET_SELECTION',
            payload: {
              row: result.row,
              col: result.col,
              direction: result.direction,
              clueNumber: grid[result.row][result.col].number,
            },
          });

          // Update highlighted cells
          const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
          if (clueKey) {
            const cells = getCellsForClue(clueKey, clueMap);
            const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
            dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [grid, clueMap, selection, userGrid, dispatch]);
}
