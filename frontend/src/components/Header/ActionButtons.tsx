import React, { useState, useEffect, useRef } from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { validatePuzzle, revealAllAnswers, getCorrectLetter } from '../../utils/validationUtils';
import { getClueKeyForCell, getCellsForClue } from '../../utils/gridUtils';
import SavesManager from '../../utils/savesManager';

interface ActionButtonsProps {
  onOpenLibrary?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onOpenLibrary }) => {
  const { state, dispatch } = usePuzzle();
  const [showConfirm, setShowConfirm] = useState<'reveal' | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [showRevealMenu, setShowRevealMenu] = useState(false);
  const revealMenuRef = useRef<HTMLDivElement>(null);

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
      alert('Congratulations! Puzzle complete! 🎉');
    } else if (result.incorrectCells.size > 0) {
      alert(`${result.incorrectCells.size} cell(s) are incorrect. They are marked in red.`);
    } else {
      alert('All filled cells are correct! Keep going!');
    }
  };

  const handleRevealCell = () => {
    if (!state.selection) {
      alert('Please select a cell first.');
      return;
    }

    const { row, col } = state.selection;
    const correctLetter = getCorrectLetter(state.puzzle!, row, col);

    dispatch({
      type: 'SET_CELL_VALUE',
      payload: { row, col, value: correctLetter },
    });

    // Clear any incorrect marking
    dispatch({
      type: 'CHECK_CELL',
      payload: { row, col, isCorrect: true },
    });
  };

  const handleRevealWord = () => {
    if (!state.selection || !state.grid || !state.clueMap) {
      alert('Please select a cell first.');
      return;
    }

    const { row, col, direction } = state.selection;

    // Get the clue key for the current word
    const clueKey = getClueKeyForCell(state.grid, row, col, direction, state.clueMap);

    if (!clueKey) {
      alert('No word found at current position.');
      return;
    }

    // Get all cells in the current word
    const cells = getCellsForClue(clueKey, state.clueMap);

    // Reveal all letters in the word
    cells.forEach(cell => {
      const correctLetter = getCorrectLetter(state.puzzle!, cell.row, cell.col);
      dispatch({
        type: 'SET_CELL_VALUE',
        payload: { row: cell.row, col: cell.col, value: correctLetter },
      });

      // Clear any incorrect marking
      dispatch({
        type: 'CHECK_CELL',
        payload: { row: cell.row, col: cell.col, isCorrect: true },
      });
    });

    alert(`Word revealed! (${cells.length} letters)`);
  };

  const handleRevealPuzzle = () => {
    if (showConfirm === 'reveal') {
      const revealedGrid = revealAllAnswers(state.puzzle!);

      // Set all cells
      revealedGrid.forEach((letter, cellKey) => {
        const [row, col] = cellKey.split(',').map(Number);
        dispatch({
          type: 'SET_CELL_VALUE',
          payload: { row, col, value: letter },
        });
      });

      // Clear all checks
      dispatch({ type: 'CLEAR_CHECKS' });
      dispatch({ type: 'SET_COMPLETE', payload: true });
      setShowConfirm(null);
      alert('Puzzle revealed!');
    } else {
      setShowConfirm('reveal');
      setTimeout(() => setShowConfirm(null), 3000);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the puzzle?')) {
      dispatch({ type: 'CLEAR_GRID' });
      dispatch({ type: 'RESET_TIMER' });
      alert('Puzzle reset!');
    }
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

  return (
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
              className={`reveal-menu-item ${showConfirm === 'reveal' ? 'reveal-confirm' : ''}`}
              onClick={() => {
                handleRevealPuzzle();
                if (showConfirm !== 'reveal') {
                  setShowRevealMenu(false);
                }
              }}
            >
              {showConfirm === 'reveal' ? '⚠️ Confirm?' : '🔓 Reveal Puzzle'}
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

      <button
        className="btn btn-reset"
        onClick={handleReset}
        title="Reset puzzle"
        aria-label="Reset puzzle to start"
      >
        ↻ Reset
      </button>
    </div>
  );
};

export default ActionButtons;
