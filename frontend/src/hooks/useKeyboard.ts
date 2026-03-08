import { useEffect } from 'react';
import { usePuzzle } from '../context/PuzzleContext';
import {
  handleArrowKey,
  getNextWord,
  getPreviousWord,
  getPreviousCellInWordOrPreviousWord,
} from '../utils/navigationUtils';
import { getClueKeyForCell, getCellsForClue } from '../utils/gridUtils';

export function useKeyboard() {
  const { state, dispatch } = usePuzzle();
  const { grid, clueMap, selection, userGrid } = state;

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
        const result = e.shiftKey
          ? getNextWord(grid, row, col, direction, clueMap)
          : getPreviousWord(grid, row, col, direction, clueMap);

        if (result) {
          const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
          let targetRow = result.row;
          let targetCol = result.col;
          if (clueKey) {
            const cells = getCellsForClue(clueKey, clueMap);
            const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
            dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
            const emptyCell = cells.find(c => !userGrid.get(`${c.row},${c.col}`));
            if (emptyCell) { targetRow = emptyCell.row; targetCol = emptyCell.col; }
          }
          dispatch({
            type: 'SET_SELECTION',
            payload: { row: targetRow, col: targetCol, direction: result.direction, clueNumber: grid[targetRow][targetCol].number },
          });
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
        const result = getNextWord(grid, row, col, direction, clueMap);
        if (result) {
          const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
          let targetRow = result.row;
          let targetCol = result.col;
          if (clueKey) {
            const cells = getCellsForClue(clueKey, clueMap);
            const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
            dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
            const emptyCell = cells.find(c => !userGrid.get(`${c.row},${c.col}`));
            if (emptyCell) { targetRow = emptyCell.row; targetCol = emptyCell.col; }
          }
          dispatch({
            type: 'SET_SELECTION',
            payload: { row: targetRow, col: targetCol, direction: result.direction, clueNumber: grid[targetRow][targetCol].number },
          });
        }
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
        const letter = e.key.toUpperCase();

        // Set cell value
        dispatch({
          type: 'SET_CELL_VALUE',
          payload: { row, col, value: letter },
        });

        // Auto-advance to next empty cell
        let advanceResult: { row: number; col: number; direction: 'across' | 'down' } | null = null;
        const wordClueKey = getClueKeyForCell(grid, row, col, direction, clueMap);
        if (wordClueKey) {
          const wordCells = getCellsForClue(wordClueKey, clueMap);
          const currentIdx = wordCells.findIndex(c => c.row === row && c.col === col);
          const nextEmpty = wordCells.slice(currentIdx + 1).find(c => !userGrid.get(`${c.row},${c.col}`));
          if (nextEmpty) {
            advanceResult = { ...nextEmpty, direction };
          } else {
            // All remaining cells in word are filled — go to next word's first empty cell
            const nextWord = getNextWord(grid, row, col, direction, clueMap);
            if (nextWord) {
              const nextClueKey = getClueKeyForCell(grid, nextWord.row, nextWord.col, nextWord.direction, clueMap);
              if (nextClueKey) {
                const nextWordCells = getCellsForClue(nextClueKey, clueMap);
                const emptyInNext = nextWordCells.find(c => !userGrid.get(`${c.row},${c.col}`));
                advanceResult = emptyInNext
                  ? { ...emptyInNext, direction: nextWord.direction }
                  : { row: nextWord.row, col: nextWord.col, direction: nextWord.direction };
              }
            }
          }
        }
        if (advanceResult) {
          dispatch({
            type: 'SET_SELECTION',
            payload: { row: advanceResult.row, col: advanceResult.col, direction: advanceResult.direction, clueNumber: grid[advanceResult.row][advanceResult.col].number },
          });
          const clueKey = getClueKeyForCell(grid, advanceResult.row, advanceResult.col, advanceResult.direction, clueMap);
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
