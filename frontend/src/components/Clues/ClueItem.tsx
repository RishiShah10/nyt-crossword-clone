import React, { useEffect, useRef } from 'react';
import type { ClueInfo } from '../../types/puzzle';
import styles from './ClueList.module.css';

interface ClueItemProps {
  clue: ClueInfo;
  isActive: boolean;
  onClick: () => void;
}

const ClueItem: React.FC<ClueItemProps> = ({ clue, isActive, onClick }) => {
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className={styles.clueNumber} aria-hidden="true">{clue.number}.</span>
      <span className={styles.clueText}>{clue.clue}</span>
    </li>
  );
};

export default ClueItem;
