import React, { useState, useEffect } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { puzzleApi } from '../../api/client';
import styles from './PuzzleSelector.module.css';

const PuzzleSelector: React.FC = () => {
  const { state, dispatch } = usePuzzle();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const MIN_DATE = '2010-01-01';
  const MAX_DATE = '2018-12-31';

  // Sync selectedDate with loaded puzzle
  useEffect(() => {
    if (state.puzzle?.date) {
      setSelectedDate(state.puzzle.date);
    }
  }, [state.puzzle?.date]);

  const hasProgress = (): boolean => {
    return state.userGrid && state.userGrid.size > 0;
  };

  const confirmSwitch = (): boolean => {
    if (hasProgress()) {
      return confirm('Switch puzzles? Your current progress will be lost.');
    }
    return true;
  };

  const handleDateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;

    if (!newDate || newDate === selectedDate) return;
    if (!confirmSwitch()) {
      event.target.value = selectedDate;
      return;
    }

    setIsLoading(true);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await puzzleApi.getPuzzleByDate(newDate);
      dispatch({
        type: 'SET_PUZZLE',
        payload: {
          puzzle: response.puzzle,
          puzzleId: response.puzzle_id,
        },
      });
      setSelectedDate(newDate);
    } catch (error) {
      console.error('Error loading puzzle by date:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to load puzzle for this date. Please try another.',
      });
      event.target.value = selectedDate;
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomPuzzle = async () => {
    if (!confirmSwitch()) return;

    setIsLoading(true);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await puzzleApi.getRandomPuzzle();
      dispatch({
        type: 'SET_PUZZLE',
        payload: {
          puzzle: response.puzzle,
          puzzleId: response.puzzle_id,
        },
      });
    } catch (error) {
      console.error('Error loading random puzzle:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to load random puzzle. Please try again.',
      });
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!state.puzzle) return null;

  return (
    <div className={styles.puzzleSelector} role="region" aria-label="Puzzle selection">
      <div className={styles.selectorGroup}>
        <div className={styles.dateWrapper}>
          <span className={styles.dateIcon}>📅</span>
          <input
            id="puzzle-date"
            type="date"
            className={styles.dateInput}
            value={selectedDate}
            onChange={handleDateChange}
            min={MIN_DATE}
            max={MAX_DATE}
            disabled={isLoading}
            aria-label="Select puzzle date"
          />
        </div>
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
