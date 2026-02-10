import React from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import ClueItem from './ClueItem';
import { getClueKeyForCell } from '../../utils/gridUtils';
import styles from './ClueList.module.css';

const ClueList: React.FC = () => {
  const { state, dispatch } = usePuzzle();

  if (!state.puzzle || !state.clueMap || !state.grid) {
    return <div className={styles.cluesLoading}>Loading clues...</div>;
  }

  const { clueMap, selection, grid } = state;

  // Get active clue key
  const activeClueKey = selection
    ? getClueKeyForCell(grid, selection.row, selection.col, selection.direction, clueMap)
    : null;

  // Separate clues by direction
  const acrossClues = Array.from(clueMap.values()).filter(c => c.direction === 'across');
  const downClues = Array.from(clueMap.values()).filter(c => c.direction === 'down');

  // Handle clue click
  const handleClueClick = (clue: typeof acrossClues[0]) => {
    if (clue.cells.length === 0) return;

    const firstCell = clue.cells[0];
    dispatch({
      type: 'SET_SELECTION',
      payload: {
        row: firstCell.row,
        col: firstCell.col,
        direction: clue.direction,
        clueNumber: clue.number,
      },
    });

    // Update highlighted cells
    const highlighted = new Set(clue.cells.map(c => `${c.row},${c.col}`));
    dispatch({ type: 'SET_HIGHLIGHTED_CELLS', payload: highlighted });
  };

  // Navigate to previous/next clue in a list
  const handleNavigateClue = (clues: typeof acrossClues, currentIndex: number, delta: number) => {
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < clues.length) {
      handleClueClick(clues[newIndex]);
    }
  };

  return (
    <div className={styles.cluesContainer}>
      <section className={styles.cluesSection} aria-label="Across clues">
        <h3 className={styles.cluesHeading}>Across</h3>
        <ul className={styles.cluesList} role="list">
          {acrossClues.map((clue, index) => {
            const clueKey = `${clue.number}-across`;
            const isActive = clueKey === activeClueKey;

            return (
              <ClueItem
                key={clueKey}
                clue={clue}
                isActive={isActive}
                onClick={() => handleClueClick(clue)}
                onArrowUp={() => handleNavigateClue(acrossClues, index, -1)}
                onArrowDown={() => handleNavigateClue(acrossClues, index, 1)}
              />
            );
          })}
        </ul>
      </section>

      <section className={styles.cluesSection} aria-label="Down clues">
        <h3 className={styles.cluesHeading}>Down</h3>
        <ul className={styles.cluesList} role="list">
          {downClues.map((clue, index) => {
            const clueKey = `${clue.number}-down`;
            const isActive = clueKey === activeClueKey;

            return (
              <ClueItem
                key={clueKey}
                clue={clue}
                isActive={isActive}
                onClick={() => handleClueClick(clue)}
                onArrowUp={() => handleNavigateClue(downClues, index, -1)}
                onArrowDown={() => handleNavigateClue(downClues, index, 1)}
              />
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default ClueList;
