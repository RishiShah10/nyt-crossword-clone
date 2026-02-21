import React, { useState, useEffect, useRef } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { validatePuzzle, revealAllAnswers, getCorrectLetter } from '../../utils/validationUtils';
import { getClueKeyForCell, getCellsForClue } from '../../utils/gridUtils';
import SavesManager from '../../utils/savesManager';
import Modal from './Modal';

interface ActionButtonsProps {
  onOpenLibrary?: () => void;
  onLoadRandom?: () => void;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'info' | 'warning';
  onConfirm?: () => void;
  confirmLabel?: string;
}

const MODAL_CLOSED: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'info',
};

const ActionButtons: React.FC<ActionButtonsProps> = ({ onOpenLibrary, onLoadRandom }) => {
  const { state, dispatch } = usePuzzle();
  const [showSaved, setShowSaved] = useState(false);
  const [showRevealMenu, setShowRevealMenu] = useState(false);
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const revealMenuRef = useRef<HTMLDivElement>(null);

  const closeModal = () => setModal(MODAL_CLOSED);

  const showInfo = (title: string, message: string) => {
    setModal({ isOpen: true, title, message, variant: 'info' });
  };

  const showConfirmModal = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirm') => {
    setModal({ isOpen: true, title, message, variant: 'warning', onConfirm, confirmLabel });
  };

  // Close reveal menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (revealMenuRef.current && !revealMenuRef.current.contains(event.target as Node)) {
        setShowRevealMenu(false);
      }
    };

    if (showRevealMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRevealMenu]);

  if (!state.puzzle) return null;

  const handleCheck = () => {
    const result = validatePuzzle(state.puzzle!, state.userGrid);

    // Mark incorrect cells
    result.incorrectCells.forEach(cellKey => {
      dispatch({
        type: 'CHECK_CELL',
        payload: {
          row: parseInt(cellKey.split(',')[0]),
          col: parseInt(cellKey.split(',')[1]),
          isCorrect: false,
        },
      });
    });

    // Update completion status
    if (result.isAllCorrect) {
      dispatch({ type: 'SET_COMPLETE', payload: true });
      showInfo('Puzzle Complete!', 'Congratulations! All answers are correct!');
    } else if (result.incorrectCells.size > 0) {
      showInfo('Check Results', `${result.incorrectCells.size} cell${result.incorrectCells.size !== 1 ? 's are' : ' is'} incorrect. They are marked in red.`);
    } else {
      showInfo('Looking Good!', 'All filled cells are correct. Keep going!');
    }
  };

  const handleRevealCell = () => {
    if (!state.selection) {
      showInfo('No Cell Selected', 'Please select a cell first.');
      return;
    }

    const { row, col } = state.selection;
    const correctLetter = getCorrectLetter(state.puzzle!, row, col);

    dispatch({
      type: 'SET_CELL_VALUE',
      payload: { row, col, value: correctLetter },
    });

    dispatch({
      type: 'CHECK_CELL',
      payload: { row, col, isCorrect: true },
    });
  };

  const handleRevealWord = () => {
    if (!state.selection || !state.grid || !state.clueMap) {
      showInfo('No Cell Selected', 'Please select a cell first.');
      return;
    }

    const { row, col, direction } = state.selection;
    const clueKey = getClueKeyForCell(state.grid, row, col, direction, state.clueMap);

    if (!clueKey) {
      showInfo('No Word Found', 'No word found at current position.');
      return;
    }

    const cells = getCellsForClue(clueKey, state.clueMap);

    showConfirmModal(
      'Reveal Word',
      `Reveal all ${cells.length} letters in this word?`,
      () => {
        cells.forEach(cell => {
          const correctLetter = getCorrectLetter(state.puzzle!, cell.row, cell.col);
          dispatch({
            type: 'SET_CELL_VALUE',
            payload: { row: cell.row, col: cell.col, value: correctLetter },
          });
          dispatch({
            type: 'CHECK_CELL',
            payload: { row: cell.row, col: cell.col, isCorrect: true },
          });
        });
        closeModal();
      },
      'Reveal'
    );
  };

  const handleRevealPuzzle = () => {
    showConfirmModal(
      'Reveal Entire Puzzle',
      'Are you sure? This will reveal all answers and mark the puzzle as complete. This cannot be undone.',
      () => {
        const revealedGrid = revealAllAnswers(state.puzzle!);
        revealedGrid.forEach((letter, cellKey) => {
          const [r, c] = cellKey.split(',').map(Number);
          dispatch({
            type: 'SET_CELL_VALUE',
            payload: { row: r, col: c, value: letter },
          });
        });
        dispatch({ type: 'CLEAR_CHECKS' });
        dispatch({ type: 'SET_COMPLETE', payload: true });
        closeModal();
      },
      'Reveal Puzzle'
    );
  };

  const handleReset = () => {
    showConfirmModal(
      'Reset Puzzle',
      'Are you sure you want to reset the puzzle? All your progress will be lost.',
      () => {
        dispatch({ type: 'CLEAR_GRID' });
        dispatch({ type: 'RESET_TIMER' });
        closeModal();
      },
      'Reset'
    );
  };

  const handleClearChecks = () => {
    dispatch({ type: 'CLEAR_CHECKS' });
  };

  const handleSave = () => {
    if (state.puzzleId && state.puzzle) {
      SavesManager.savePuzzleProgress(
        state.puzzleId,
        state.userGrid,
        state.checkedCells,
        state.elapsedSeconds,
        state.isComplete,
        state.puzzle
      );
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  };

  const handleTogglePause = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  };

  return (
    <>
      <div className="action-buttons" role="toolbar" aria-label="Puzzle actions">
        <button
          className="btn btn-check"
          onClick={handleCheck}
          title="Check your answers"
          aria-label="Check puzzle answers"
        >
          ✓ Check
        </button>

        <div className="reveal-dropdown" ref={revealMenuRef}>
          <button
            className="btn btn-reveal"
            onClick={() => setShowRevealMenu(!showRevealMenu)}
            title="Reveal options"
            aria-label="Reveal options menu"
          >
            💡 Reveal ▾
          </button>
          {showRevealMenu && (
            <div className="reveal-menu">
              <button
                className="reveal-menu-item"
                onClick={() => {
                  handleRevealCell();
                  setShowRevealMenu(false);
                }}
              >
                💡 Reveal Cell
              </button>
              <button
                className="reveal-menu-item"
                onClick={() => {
                  handleRevealWord();
                  setShowRevealMenu(false);
                }}
              >
                📝 Reveal Word
              </button>
              <button
                className="reveal-menu-item"
                onClick={() => {
                  handleRevealPuzzle();
                  setShowRevealMenu(false);
                }}
              >
                🔓 Reveal Puzzle
              </button>
            </div>
          )}
        </div>

        {state.checkedCells.size > 0 && (
          <button
            className="btn btn-clear"
            onClick={handleClearChecks}
            title="Clear error marks"
            aria-label="Clear incorrect cell marks"
          >
            Clear Marks
          </button>
        )}

        <button
          className={`btn btn-save ${showSaved ? 'btn-saved' : ''}`}
          onClick={handleSave}
          title="Save puzzle progress"
          aria-label="Save puzzle progress"
        >
          {showSaved ? '✓ Saved!' : '💾 Save'}
        </button>

        <button
          className={`btn btn-pause ${state.isPaused ? 'btn-paused' : ''}`}
          onClick={handleTogglePause}
          title={state.isPaused ? 'Resume timer' : 'Pause timer'}
          aria-label={state.isPaused ? 'Resume timer' : 'Pause timer'}
        >
          {state.isPaused ? '▶️ Resume' : '⏸️ Pause'}
        </button>

        {onOpenLibrary && (
          <button
            className="btn btn-library"
            onClick={onOpenLibrary}
            title="Open puzzle library"
            aria-label="Open puzzle library"
          >
            📚 Library
          </button>
        )}

        {onLoadRandom && (
          <button
            className="btn btn-library"
            onClick={onLoadRandom}
            title="Load a random puzzle"
            aria-label="Load a random puzzle"
          >
            🎲 Random
          </button>
        )}

        <button
          className="btn btn-reset"
          onClick={handleReset}
          title="Reset puzzle"
          aria-label="Reset puzzle to start"
        >
          ↻ Reset
        </button>
      </div>

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onConfirm={modal.onConfirm}
        confirmLabel={modal.confirmLabel}
        onClose={closeModal}
      />
    </>
  );
};

export default ActionButtons;
