import React, { useRef, useEffect } from 'react';
import type { Cell as CellType } from '../../types/puzzle';
import styles from './Grid.module.css';

interface CellProps {
  cell: CellType;
  value: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isIncorrect: boolean;
  onClick: () => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const Cell: React.FC<CellProps> = ({
  cell,
  value,
  isSelected,
  isHighlighted,
  isIncorrect,
  onClick,
  onChange,
  onKeyDown,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when selected
  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  if (cell.isBlack) {
    return <div className={`${styles.cell} ${styles.cellBlack}`} />;
  }

  const cellClasses = [
    styles.cell,
    styles.cellWhite,
    isSelected && styles.cellSelected,
    isHighlighted && styles.cellHighlighted,
    isIncorrect && styles.cellIncorrect,
    cell.isCircled && styles.cellCircled,
    cell.isShaded && styles.cellShaded,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClasses} onClick={onClick} role="gridcell">
      {cell.number && <span className={styles.cellNumber} aria-hidden="true">{cell.number}</span>}
      <input
        ref={inputRef}
        type="text"
        className={styles.cellInput}
        value={value}
        maxLength={1}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        aria-label={cell.number ? `Cell ${cell.number}` : 'Cell'}
        aria-invalid={isIncorrect}
      />
      {isIncorrect && <div className={styles.cellIncorrectMark} aria-hidden="true" />}
    </div>
  );
};

export default Cell;
