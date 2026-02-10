import React, { useEffect, useRef } from 'react';
import type { ClueInfo } from '../../types/puzzle';
import styles from './ClueList.module.css';

interface ClueItemProps {
  clue: ClueInfo;
  isActive: boolean;
  onClick: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

const ClueItem: React.FC<ClueItemProps> = ({ clue, isActive, onClick, onArrowUp, onArrowDown }) => {
  const itemRef = useRef<HTMLLIElement>(null);

  // Auto-scroll into view when active
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    } else if (e.key === 'ArrowUp' && onArrowUp) {
      e.preventDefault();
      onArrowUp();
    } else if (e.key === 'ArrowDown' && onArrowDown) {
      e.preventDefault();
      onArrowDown();
    }
  };

  const clueClasses = [styles.clueItem, isActive && styles.clueItemActive]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={itemRef}
      className={clueClasses}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Clue ${clue.number}: ${clue.clue}`}
      aria-pressed={isActive}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.clueNumber} aria-hidden="true">{clue.number}.</span>
      <span className={styles.clueText}>{clue.clue}</span>
    </li>
  );
};

export default ClueItem;
