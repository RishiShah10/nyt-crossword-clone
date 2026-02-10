import { usePuzzle } from '../context/PuzzleContext';

/**
 * Hook for puzzle timer functionality
 * Timer is managed in PuzzleContext, this hook provides utilities
 */
export function useTimer() {
  const { state } = usePuzzle();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    elapsedSeconds: state.elapsedSeconds,
    formattedTime: formatTime(state.elapsedSeconds),
  };
}
