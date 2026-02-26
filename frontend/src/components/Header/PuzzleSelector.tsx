import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePuzzle } from '../../context/PuzzleContext';
import { useRoom } from '../../context/RoomContext';
import { puzzleApi } from '../../api/client';
import styles from './PuzzleSelector.module.css';

const PuzzleSelector: React.FC = () => {
  const { state, dispatch } = usePuzzle();
  const { isInRoom, changeRoomPuzzle } = useRoom();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);

  const MIN_DATE = '2010-01-01';
  const MAX_DATE = new Date().toISOString().split('T')[0];

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
      const response = isMiniMode
        ? await puzzleApi.getMiniPuzzleByDate(newDate)
        : await puzzleApi.getPuzzleByDate(newDate);
      await applyPuzzle(response.puzzle, response.puzzle_id);
      setSelectedDate(newDate);
    } catch (error) {
      let message = 'Failed to load puzzle for this date. Please try another.';
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          message = 'NYT cookie is invalid or expired. Update NYT_COOKIE in your .env file.';
        } else if (error.response?.status === 503) {
          message = 'NYT live puzzles are not configured for dates after 2018.';
        }
      }
      console.error('Error loading puzzle by date:', error);
      dispatch({ type: 'SET_ERROR', payload: message });
      event.target.value = selectedDate;
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomPuzzle = async () => {
    if (!confirmSwitch()) return;

    setIsLoading(true);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = isMiniMode
        ? await puzzleApi.getRandomMiniPuzzle()
        : await puzzleApi.getRandomPuzzle();
      await applyPuzzle(response.puzzle, response.puzzle_id);
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

  const handleTodaysPuzzle = async () => {
    if (!confirmSwitch()) return;

    setIsLoading(true);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = isMiniMode
        ? await puzzleApi.getTodaysMiniPuzzle()
        : await puzzleApi.getTodaysLivePuzzle();
      await applyPuzzle(response.puzzle, response.puzzle_id);
      setSelectedDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      let message = "Failed to load today's puzzle.";
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          message = 'NYT cookie is invalid or expired. Update NYT_COOKIE in your .env file.';
        } else if (error.response?.status === 503) {
          message = 'NYT live puzzles are not configured. Set NYT_COOKIE in your .env file.';
        }
      }
      console.error("Error loading today's puzzle:", error);
      dispatch({ type: 'SET_ERROR', payload: message });
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!state.puzzle) return null;

  return (
    <div className={styles.puzzleSelector} role="region" aria-label="Puzzle selection">
      <div className={styles.selectorGroup}>
        <div className={`${styles.toggleWrapper} ${isLoading ? styles.toggleDisabled : ''}`}>
          <span
            className={`${styles.toggleLabel} ${!isMiniMode ? styles.active : ''}`}
            onClick={() => !isLoading && setIsMiniMode(false)}
          >
            Daily
          </span>
          <span
            className={`${styles.toggleLabel} ${isMiniMode ? styles.active : ''}`}
            onClick={() => !isLoading && setIsMiniMode(true)}
          >
            Mini
          </span>
        </div>
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
        <button
          className={styles.randomBtn}
          onClick={handleTodaysPuzzle}
          disabled={isLoading}
          aria-label={isMiniMode ? "Load today's mini puzzle" : "Load today's NYT puzzle"}
        >
          {isMiniMode ? "📰 Today's Mini" : "📰 Today's NYT"}
        </button>
      </div>
    </div>
  );
};

export default PuzzleSelector;
