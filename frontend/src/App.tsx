import { useEffect, useState } from 'react';
import { usePuzzle } from './context/PuzzleContext';
import { puzzleApi } from './api/client';
import Grid from './components/Grid/Grid';
import ClueList from './components/Clues/ClueList';
import Timer from './components/Header/Timer';
import ActionButtons from './components/Header/ActionButtons';
import CurrentClue from './components/Header/CurrentClue';
import PuzzleLibrary from './components/Library/PuzzleLibrary';
import SavesManager from './utils/savesManager';
import './App.css';

function App() {
  const { state, dispatch } = usePuzzle();
  const [showLibrary, setShowLibrary] = useState(false);

  // Cleanup old saves on mount
  useEffect(() => {
    SavesManager.cleanupOldSaves(30);
  }, []);

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

  // Handler to load a saved puzzle from library
  const handleSelectPuzzle = async (puzzleId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Load the saved puzzle data
      const saveData = SavesManager.loadPuzzleProgress(puzzleId);

      if (saveData && saveData.puzzle) {
        // Use the stored puzzle data
        dispatch({
          type: 'SET_PUZZLE',
          payload: {
            puzzle: saveData.puzzle,
            puzzleId: puzzleId,
          },
        });
      } else {
        // If no saved puzzle data, try loading from API by date
        const response = await puzzleApi.getPuzzleByDate(puzzleId);
        dispatch({
          type: 'SET_PUZZLE',
          payload: {
            puzzle: response.puzzle,
            puzzleId: response.puzzle_id,
          },
        });
      }
    } catch (error) {
      console.error('Error loading saved puzzle:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to load saved puzzle. Please try again.',
      });
    }
  };

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

      <div className="controls-container">
        <ActionButtons onOpenLibrary={() => setShowLibrary(true)} />
      </div>

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

      <PuzzleLibrary
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelectPuzzle={handleSelectPuzzle}
      />
    </div>
  );
}

export default App;
