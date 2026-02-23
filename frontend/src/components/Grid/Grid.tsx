import React, { useMemo } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useRoom } from '../../context/RoomContext';
import Cell from './Cell';
import { getClueKeyForCell, getCellsForClue } from '../../utils/gridUtils';
import styles from './Grid.module.css';
import type { RoomPresence } from '../../types/room';

const Grid: React.FC = () => {
  const { state, dispatch } = usePuzzle();
  const { presenceList, isInRoom } = useRoom();
  useKeyboard(); // Enable keyboard navigation

  if (!state.grid || !state.clueMap) {
    return <div className={styles.gridLoading}>Loading grid...</div>;
  }

  const { grid, selection, userGrid, clueMap, checkedCells } = state;

  // Build a map of cellKey -> remote cursors for this cell
  const remoteCursorMap = useMemo(() => {
    if (!isInRoom) return new Map<string, RoomPresence[]>();
    const map = new Map<string, RoomPresence[]>();
    for (const p of presenceList) {
      if (p.selection) {
        const key = `${p.selection.row},${p.selection.col}`;
        const existing = map.get(key) || [];
        existing.push(p);
        map.set(key, existing);
      }
    }
    return map;
  }, [presenceList, isInRoom]);

  // Build a map of cellKey -> remote highlight color (word highlighting for remote users)
  const remoteHighlightMap = useMemo(() => {
    if (!isInRoom || !clueMap) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const p of presenceList) {
      if (p.selection) {
        const clueKey = getClueKeyForCell(grid, p.selection.row, p.selection.col, p.selection.direction, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          for (const c of cells) {
            const key = `${c.row},${c.col}`;
            // First remote user's color wins per cell
            if (!map.has(key)) {
              map.set(key, p.color);
            }
          }
        }
      }
    }
    return map;
  }, [presenceList, isInRoom, grid, clueMap]);

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    const cell = grid[row][col];
    if (cell.isBlack) return;

    // If clicking the same cell, toggle direction
    if (selection && selection.row === row && selection.col === col) {
      dispatch({ type: 'TOGGLE_DIRECTION' });
      updateHighlightedCells(row, col, selection.direction === 'across' ? 'down' : 'across');
    } else {
      // Select new cell, default to across
      const direction = 'across';
      dispatch({
        type: 'SET_SELECTION',
        payload: { row, col, direction, clueNumber: cell.number },
      });
      updateHighlightedCells(row, col, direction);
    }
  };

  // Update highlighted cells based on selection
  const updateHighlightedCells = (row: number, col: number, direction: 'across' | 'down') => {
    const clueKey = getClueKeyForCell(grid, row, col, direction, clueMap);
    if (!clueKey) {
      dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: new Set() });
      return;
    }

    const cells = getCellsForClue(clueKey, clueMap);
    const highlighted = new Set(cells.map(c => `${c.row},${c.col}`));
    dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
  };

  // Handle cell value change (now handled by useKeyboard hook, kept for mouse input only)
  const handleCellChange = (row: number, col: number, value: string) => {
    // This is mainly for mobile/touch input
    // Desktop keyboard input is handled by useKeyboard hook
    if (!value) {
      dispatch({
        type: 'SET_CELL_VALUE',
        payload: { row, col, value },
      });
    }
  };

  // Handle keyboard events on individual cells (now mostly handled globally)
  const handleKeyDown = (_row: number, _col: number, e: React.KeyboardEvent) => {
    // Most keyboard handling is done by useKeyboard hook
    // This is kept for any cell-specific handling
    e.preventDefault();
  };

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  return (
    <div className={styles.gridContainer}>
      <div
        className={styles.grid}
        role="grid"
        aria-label="Crossword puzzle grid"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {grid.map((rowCells, rowIndex) =>
          rowCells.map((cell, colIndex) => {
            const cellKey = `${rowIndex},${colIndex}`;
            const value = userGrid.get(cellKey) || '';
            const isSelected = selection?.row === rowIndex && selection?.col === colIndex;
            const isHighlighted = state.highlightedCells.has(cellKey);
            const isIncorrect = checkedCells.get(cellKey) === false;
            const isCorrect = checkedCells.get(cellKey) === true;

            const remoteCursors = remoteCursorMap.get(cellKey) || [];
            // Only show remote highlight if this cell isn't in the local user's highlighted word
            const remoteHighlightColor = !isHighlighted && !isSelected
              ? remoteHighlightMap.get(cellKey)
              : undefined;

            return (
              <Cell
                key={cellKey}
                cell={cell}
                value={value}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                isIncorrect={isIncorrect}
                isCorrect={isCorrect}
                remoteCursors={remoteCursors}
                remoteHighlightColor={remoteHighlightColor}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                onChange={(val) => handleCellChange(rowIndex, colIndex, val)}
                onKeyDown={(e) => handleKeyDown(rowIndex, colIndex, e)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default Grid;
