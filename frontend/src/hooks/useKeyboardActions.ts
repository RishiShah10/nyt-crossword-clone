import { useCallback } from 'react';
import { usePuzzle } from '../context/PuzzleContext';
import {
  getNextWord,
  getPreviousWord,
  getPreviousCellInWordOrPreviousWord,
} from '../utils/navigationUtils';
import { getClueKeyForCell, getCellsForClue } from '../utils/gridUtils';

export function useKeyboardActions() {
  const { state, dispatch } = usePuzzle();
  const { grid, clueMap, selection, userGrid } = state;

  const handleLetter = useCallback((letter: string) => {
    if (!grid || !clueMap || !selection) return;
    const { row, col, direction } = selection;
    const upperLetter = letter.toUpperCase();

    dispatch({ type: 'SET_CELL_VALUE', payload: { row, col, value: upperLetter } });

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
        dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set(cells.map(c => `${c.row},${c.col}`)) });
      }
    }
  }, [grid, clueMap, selection, userGrid, dispatch]);

  const handleBackspace = useCallback(() => {
    if (!grid || !clueMap || !selection) return;
    const { row, col, direction } = selection;
    const cellKey = `${row},${col}`;
    const currentValue = userGrid.get(cellKey) || '';

    if (currentValue) {
      dispatch({ type: 'SET_CELL_VALUE', payload: { row, col, value: '' } });
    } else {
      const result = getPreviousCellInWordOrPreviousWord(grid, row, col, direction, clueMap);
      if (result) {
        dispatch({
          type: 'SET_SELECTION',
          payload: { row: result.row, col: result.col, direction: result.direction, clueNumber: grid[result.row][result.col].number },
        });
        dispatch({ type: 'SET_CELL_VALUE', payload: { row: result.row, col: result.col, value: '' } });
        const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set(cells.map(c => `${c.row},${c.col}`)) });
        }
      }
    }
  }, [grid, clueMap, selection, userGrid, dispatch]);

  const handleToggleDirection = useCallback(() => {
    if (!grid || !clueMap || !selection) return;
    const { row, col, direction } = selection;
    dispatch({ type: 'TOGGLE_DIRECTION' });
    const newDirection = direction === 'across' ? 'down' : 'across';
    const clueKey = getClueKeyForCell(grid, row, col, newDirection, clueMap);
    if (clueKey) {
      const cells = getCellsForClue(clueKey, clueMap);
      dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set(cells.map(c => `${c.row},${c.col}`)) });
    }
  }, [grid, clueMap, selection, dispatch]);

  const handleNextWord = useCallback(() => {
    if (!grid || !clueMap || !selection) return;
    const { row, col, direction } = selection;
    const result = getNextWord(grid, row, col, direction, clueMap);
    if (result) {
      const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
      let targetRow = result.row;
      let targetCol = result.col;
      if (clueKey) {
        const cells = getCellsForClue(clueKey, clueMap);
        dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set(cells.map(c => `${c.row},${c.col}`)) });
        const emptyCell = cells.find(c => !userGrid.get(`${c.row},${c.col}`));
        if (emptyCell) { targetRow = emptyCell.row; targetCol = emptyCell.col; }
      }
      dispatch({
        type: 'SET_SELECTION',
        payload: { row: targetRow, col: targetCol, direction: result.direction, clueNumber: grid[targetRow][targetCol].number },
      });
    }
  }, [grid, clueMap, selection, userGrid, dispatch]);

  const handlePrevWord = useCallback(() => {
    if (!grid || !clueMap || !selection) return;
    const { row, col, direction } = selection;
    const result = getPreviousWord(grid, row, col, direction, clueMap);
    if (result) {
      const clueKey = getClueKeyForCell(grid, result.row, result.col, result.direction, clueMap);
      let targetRow = result.row;
      let targetCol = result.col;
      if (clueKey) {
        const cells = getCellsForClue(clueKey, clueMap);
        dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set(cells.map(c => `${c.row},${c.col}`)) });
        const emptyCell = cells.find(c => !userGrid.get(`${c.row},${c.col}`));
        if (emptyCell) { targetRow = emptyCell.row; targetCol = emptyCell.col; }
      }
      dispatch({
        type: 'SET_SELECTION',
        payload: { row: targetRow, col: targetCol, direction: result.direction, clueNumber: grid[targetRow][targetCol].number },
      });
    }
  }, [grid, clueMap, selection, userGrid, dispatch]);

  return { handleLetter, handleBackspace, handleToggleDirection, handleNextWord, handlePrevWord };
}
