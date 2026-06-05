import React, { useState } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { useRoom } from '../../context/RoomContext';
import { puzzleApi } from '../../api/client';
import styles from './PuzzleSelector.module.css';

const PuzzleSelector: React.FC = () => {
  const { state, dispatch } = usePuzzle();
  const { isInRoom, changeRoomPuzzle } = useRoom();
  const [isLoading, setIsLoading] = useState(false);

  const hasProgress = (): boolean => {
    return !!state.userGrid && state.userGrid.size > 0;
  };

  const confirmSwitch = (): boolean => {
    if (isInRoom) {
      return confirm('Switch puzzles for everyone in the room? Current progress will be lost.');
    }
    if (hasProgress()) {
      return confirm('Switch puzzles? Your current progress will be lost.');
    }
    return true;
  };

  const applyPuzzle = async (puzzle: any, puzzleId: string) => {
    if (isInRoom) {
      await changeRoomPuzzle(puzzleId, puzzle);
    } else {
      dispatch({ type: 'SET_PUZZLE', payload: { puzzle, puzzleId } });
    }
  };

  const handleRandomPuzzle = async () => {
    if (!confirmSwitch()) return;

    setIsLoading(true);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await puzzleApi.getRandomPuzzle();
      await applyPuzzle(response.puzzle, response.puzzle_id);
    } catch (error) {
      console.error('Error loading random puzzle:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load random puzzle. Please try again.' });
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!state.puzzle) return null;

  return (
    <div className={styles.puzzleSelector} role="region" aria-label="Puzzle selection">
      <div className={styles.selectorGroup}>
        <button
          className={styles.randomBtn}
          onClick={handleRandomPuzzle}
          disabled={isLoading}
          aria-label="Load random puzzle"
        >
          {isLoading ? '⏳ Loading...' : '🎲 Random'}
        </button>
      </div>
    </div>
  );
};

export default PuzzleSelector;
