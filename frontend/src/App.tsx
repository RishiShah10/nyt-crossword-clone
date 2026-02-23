import { useEffect, useState } from 'react';
import { usePuzzle } from './context/PuzzleContext';
import { useAuth } from './context/AuthContext';
import { useRoom } from './context/RoomContext';
import { puzzleApi } from './api/client';
import Grid from './components/Grid/Grid';
import ClueList from './components/Clues/ClueList';
import Timer from './components/Header/Timer';
import ActionButtons from './components/Header/ActionButtons';
import PuzzleSelector from './components/Header/PuzzleSelector';
import CurrentClue from './components/Header/CurrentClue';
import PuzzleLibrary from './components/Library/PuzzleLibrary';
import GoogleSignIn from './components/Auth/GoogleSignIn';
import UserMenu from './components/Auth/UserMenu';
import CreateRoom from './components/Room/CreateRoom';
import JoinRoom from './components/Room/JoinRoom';
import RoomBar from './components/Room/RoomBar';
import SavesManager from './utils/savesManager';
import { savesApi } from './api/savesApi';
import Confetti from './components/Confetti';
import './App.css';

function App() {
  const { state, dispatch } = usePuzzle();
  const { isAuthenticated, isNewUser, clearNewUserFlag } = useAuth();
  const { room, myMember, presenceList, isInRoom, leaveRoom, changeColor } = useRoom();
  const [showLibrary, setShowLibrary] = useState(false);

  // Cleanup old saves on mount
  useEffect(() => {
    SavesManager.cleanupOldSaves(30);
  }, []);

  // Migration: offer to upload localStorage saves when new user signs in
  useEffect(() => {
    if (isNewUser && isAuthenticated) {
      const localSaves = SavesManager.getAllSaves();
      if (localSaves.length > 0) {
        const shouldMigrate = confirm(
          `Welcome! We found ${localSaves.length} saved puzzle${localSaves.length !== 1 ? 's' : ''} on this device. Upload them to your account?`
        );
        if (shouldMigrate) {
          const savesToUpload = localSaves.map(meta => {
            const saveData = SavesManager.loadPuzzleProgress(meta.puzzleId);
            return {
              puzzle_id: meta.puzzleId,
              user_grid: saveData?.userGrid ? Array.from(new Map(saveData.userGrid).entries()) : [],
              checked_cells: saveData?.checkedCells ? Array.from(new Map(saveData.checkedCells).entries()) : [],
              elapsed_seconds: meta.elapsedSeconds,
              is_complete: meta.isComplete,
              cells_filled: meta.cellsFilled,
              total_cells: meta.totalCells,
              completion_pct: meta.completionPercent,
              puzzle_date: meta.date,
            };
          });
          savesApi.bulkImport(savesToUpload)
            .then(result => alert(`Uploaded ${result.imported} puzzle${result.imported !== 1 ? 's' : ''} to your account!`))
            .catch(() => alert('Failed to upload saves. They are still saved locally.'));
        }
      }
      clearNewUserFlag();
    }
  }, [isNewUser, isAuthenticated, clearNewUserFlag]);

  useEffect(() => {
    // Load today's live puzzle on mount, fall back to random archive puzzle
    const loadPuzzle = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        let response;
        try {
          response = await puzzleApi.getTodaysLivePuzzle();
        } catch {
          response = await puzzleApi.getRandomPuzzle();
        }
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

  // Handler to load a random puzzle
  const handleLoadRandom = async () => {
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
        payload: 'Failed to load puzzle. Please try again.',
      });
    }
  };

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
          <h1>Rishi's Crossword</h1>
          {puzzle.date && <h2>{puzzle.date}</h2>}
        </div>
        <div className="puzzle-meta">
{puzzle.author && <span className="author">By {puzzle.author}</span>}
        </div>
        <Timer />
        <div className="auth-section">
          {isAuthenticated ? <UserMenu /> : <GoogleSignIn />}
        </div>
      </header>

      {isInRoom && room ? (
        <RoomBar room={room} myMember={myMember} presenceList={presenceList} onLeave={leaveRoom} onChangeColor={changeColor} />
      ) : null}

      <div className="controls-container">
        <PuzzleSelector />
        <ActionButtons onOpenLibrary={() => setShowLibrary(true)} onLoadRandom={handleLoadRandom} />
        {!isInRoom && isAuthenticated && (
          <>
            <CreateRoom puzzleId={state.puzzleId} puzzle={state.puzzle} />
            <JoinRoom />
          </>
        )}
      </div>

      <CurrentClue />

      <main className="app-main">
        <Grid />
        <ClueList />
      </main>

      <Confetti show={state.isComplete} />

      <PuzzleLibrary
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelectPuzzle={handleSelectPuzzle}
      />
    </div>
  );
}

export default App;
