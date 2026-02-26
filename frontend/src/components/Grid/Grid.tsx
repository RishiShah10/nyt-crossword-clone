import React, { useMemo } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import Cell from './Cell';
import { getClueKeyForCell, getCellsForClue } from '../../utils/gridUtils';
import { getNextCellInWordOrNextWord } from '../../utils/navigationUtils';
import styles from './Grid.module.css';
import type { RoomPresence } from '../../types/room';

// Pastel word-highlight colors matching each player's assigned color
const HIGHLIGHT_COLORS: Record<string, string> = {
  '#4A90D9': '#A7D8F0', // Blue
  '#E74C3C': '#F5C4C0', // Red
  '#2ECC71': '#B5EDCF', // Green
  '#9B59B6': '#D5BDE6', // Purple
  '#F39C12': '#FEF0D5', // Orange
  '#1ABC9C': '#C8F5ED', // Teal
  '#E91E63': '#FCDCE8', // Pink
  '#3F51B5': '#D8DCF0', // Indigo
};

// Selected-cell colors for each player
const SELECTED_COLORS: Record<string, string> = {
  '#4A90D9': '#F7DA21', // Blue → yellow
  '#E74C3C': '#F7A59E', // Red → salmon
  '#2ECC71': '#8EE4AF', // Green → mint
  '#9B59B6': '#C9A0DC', // Purple → lavender
  '#F39C12': '#FDE6A0', // Orange → soft gold
  '#1ABC9C': '#A0E8DC', // Teal → soft teal
  '#E91E63': '#F9B0CB', // Pink → soft pink
  '#3F51B5': '#B8BFE8', // Indigo → soft indigo
};

const Grid: React.FC = () => {
  const { state, dispatch } = usePuzzle();
  const { presenceList, isInRoom, myMember } = useRoom();
  const { user } = useAuth();

  // Local player's colors (in a room, use assigned color; otherwise defaults)
  const myHighlightColor = isInRoom && myMember ? HIGHLIGHT_COLORS[myMember.color] : undefined;
  const mySelectedColor = isInRoom && myMember ? SELECTED_COLORS[myMember.color] : undefined;
  const myCursorColor = isInRoom && myMember ? myMember.color : undefined;
  useKeyboard(); // Enable keyboard navigation

  if (!state.grid || !state.clueMap) {
    return <div className={styles.gridLoading}>Loading grid...</div>;
  }

  const { grid, selection, userGrid, clueMap, checkedCells } = state;

  // Filter out local user from presence list
  const remotePresence = useMemo(() => {
    if (!isInRoom || !user) return [];
    return presenceList.filter(p => p.userId !== user.id);
  }, [presenceList, isInRoom, user]);

  // Build a map of cellKey -> remote cursors for this cell
  const remoteCursorMap = useMemo(() => {
    if (!isInRoom) return new Map<string, RoomPresence[]>();
    const map = new Map<string, RoomPresence[]>();
    for (const p of remotePresence) {
      if (p.selection) {
        const key = `${p.selection.row},${p.selection.col}`;
        const existing = map.get(key) || [];
        existing.push(p);
        map.set(key, existing);
      }
    }
    return map;
  }, [remotePresence, isInRoom]);

  // Build maps for remote highlighting: word highlight + selected cell
  const { remoteHighlightMap, remoteSelectedMap } = useMemo(() => {
    const highlightMap = new Map<string, string>();
    const selectedMap = new Map<string, string>();
    if (!isInRoom || !clueMap) return { remoteHighlightMap: highlightMap, remoteSelectedMap: selectedMap };
    for (const p of remotePresence) {
      if (p.selection) {
        // Mark their selected cell
        const selKey = `${p.selection.row},${p.selection.col}`;
        if (!selectedMap.has(selKey)) {
          selectedMap.set(selKey, SELECTED_COLORS[p.color] || p.color);
        }
        // Mark their highlighted word
        const clueKey = getClueKeyForCell(grid, p.selection.row, p.selection.col, p.selection.direction, clueMap);
        if (clueKey) {
          const cells = getCellsForClue(clueKey, clueMap);
          const highlightColor = HIGHLIGHT_COLORS[p.color] || p.color;
          for (const c of cells) {
            const key = `${c.row},${c.col}`;
            if (!highlightMap.has(key)) {
              highlightMap.set(key, highlightColor);
            }
          }
        }
      }
    }
    return { remoteHighlightMap: highlightMap, remoteSelectedMap: selectedMap };
  }, [remotePresence, isInRoom, grid, clueMap]);

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    const cell = grid[row][col];
    if (cell.isBlack) return;

    // If clicking the same cell, toggle direction
    if (selection && selection.row === row && selection.col === col) {
      dispatch({ type: 'TOGGLE_DIRECTION' });
      updateHighlightedCells(row, col, selection.direction === 'across' ? 'down' : 'across');
    } else {
      // Select new cell, try to maintain current direction if valid
      // Otherwise fall back to the other direction, or across as last resort
      let direction: 'across' | 'down' = 'across';

      if (selection) {
        // Try to use current direction
        const currentDirClue = getClueKeyForCell(grid, row, col, selection.direction, clueMap);
        if (currentDirClue) {
          direction = selection.direction;
        } else {
          // Current direction not valid, try the opposite
          const oppositeDirClue = getClueKeyForCell(grid, row, col, selection.direction === 'across' ? 'down' : 'across', clueMap);
          if (oppositeDirClue) {
            direction = selection.direction === 'across' ? 'down' : 'across';
          }
        }
      } else {
        // No previous selection, prefer across, fall back to down
        const acrossClue = getClueKeyForCell(grid, row, col, 'across', clueMap);
        if (!acrossClue) {
          const downClue = getClueKeyForCell(grid, row, col, 'down', clueMap);
          if (downClue) {
            direction = 'down';
          }
        }
      }

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

  // Handle cell value change
  const handleCellChange = (_row: number, _col: number, _value: string) => {
    // All input is handled by useKeyboard hook via keydown events
    // This onChange is effectively disabled to prevent double-entry
    // Mobile keyboards still work because useKeyboard processes their keydown events
  };

  // Handle keyboard events on individual cells
  const handleKeyDown = (_row: number, _col: number, e: React.KeyboardEvent) => {
    // Prevent default on ALL keys to stop onChange from firing
    // The useKeyboard hook will handle all input via window listener
    // This prevents double-entry where both handlers try to process the same keystroke
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
            // Only show remote highlight/selected if this cell isn't in the local user's word
            const remoteHlColor = !isHighlighted && !isSelected
              ? remoteHighlightMap.get(cellKey)
              : undefined;
            const remoteSelColor = !isSelected
              ? remoteSelectedMap.get(cellKey)
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
                remoteHighlightColor={remoteHlColor}
                remoteSelectedColor={remoteSelColor}
                myHighlightColor={myHighlightColor}
                mySelectedColor={mySelectedColor}
                myCursorColor={myCursorColor}
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
