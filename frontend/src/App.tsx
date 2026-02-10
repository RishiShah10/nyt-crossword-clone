import { useEffect } from 'react';
import { usePuzzle } from './context/PuzzleContext';
import { puzzleApi } from './api/client';
import Grid from './components/Grid/Grid';
import ClueList from './components/Clues/ClueList';
import Timer from './components/Header/Timer';
import ActionButtons from './components/Header/ActionButtons';
import CurrentClue from './components/Header/CurrentClue';
import './App.css';

function App() {
  const { state, dispatch } = usePuzzle();

  useEffect(() => {
    // Load a random puzzle on mount
    const loadPuzzle = async () => {
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
        console.error('Error loading puzzle:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: 'Failed to load puzzle. Please try again.',
        });
      }
    };

    loadPuzzle();
  }, []);

  if (state.isLoading) {
    return (
      <div className="app">
        <div className="loading">Loading puzzle...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="app">
        <div className="error">{state.error}</div>
      </div>
    );
  }

  if (!state.puzzle) {
    return (
      <div className="app">
        <div className="loading">No puzzle loaded</div>
      </div>
    );
  }

  const { puzzle } = state;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>The Mini Crossword</h1>
          {puzzle.date && <h2>{puzzle.date}</h2>}
        </div>
        <div className="puzzle-meta">
          {puzzle.author && <span className="author">By {puzzle.author}</span>}
        </div>
        <Timer />
      </header>

      <ActionButtons />

      <CurrentClue />

      <main className="app-main">
        <Grid />
        <ClueList />
      </main>

      {state.isComplete && (
        <div className="completion-banner">
          🎉 Puzzle Complete! Great job! 🎉
        </div>
      )}
    </div>
  );
}

export default App;
