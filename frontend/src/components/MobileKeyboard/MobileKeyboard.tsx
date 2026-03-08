import React from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { useKeyboardActions } from '../../hooks/useKeyboardActions';
import styles from './MobileKeyboard.module.css';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['⌫', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⟳'],
];

interface MobileKeyboardProps {
  onOpenClues: () => void;
}

const MobileKeyboard: React.FC<MobileKeyboardProps> = ({ onOpenClues }) => {
  const { state, dispatch } = usePuzzle();
  const actions = useKeyboardActions();
  const { isPencilMode } = state;

  const handleKey = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(10);

    if (key === '⌫') {
      actions.handleBackspace();
    } else if (key === '⟳') {
      actions.handleToggleDirection();
    } else {
      actions.handleLetter(key);
    }
  };

  return (
    <div className={styles.keyboard}>
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.keyRow}>
          {row.map((key) => (
            <button
              key={key}
              className={`${styles.key} ${(key === '⌫' || key === '⟳') ? styles.keyAction : ''}`}
              onPointerDown={(e) => handleKey(e, key)}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className={styles.actionRow}>
        <button
          className={styles.actionRowBtn}
          onPointerDown={(e) => { e.preventDefault(); actions.handlePrevWord(); }}
        >
          ← PREV
        </button>
        <button
          className={`${styles.actionRowBtn} ${isPencilMode ? styles.pencilActive : ''}`}
          onPointerDown={(e) => { e.preventDefault(); dispatch({ type: 'TOGGLE_PENCIL' }); }}
        >
          ✏ PENCIL
        </button>
        <button
          className={styles.actionRowBtn}
          onPointerDown={(e) => { e.preventDefault(); onOpenClues(); }}
        >
          CLUES
        </button>
        <button
          className={styles.actionRowBtn}
          onPointerDown={(e) => { e.preventDefault(); actions.handleNextWord(); }}
        >
          NEXT →
        </button>
      </div>
    </div>
  );
};

export default MobileKeyboard;
