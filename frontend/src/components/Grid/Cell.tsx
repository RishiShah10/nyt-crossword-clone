import React, { useRef, useEffect } from 'react';
import type { Cell as CellType } from '../../types/puzzle';
import type { RoomPresence } from '../../types/room';
import styles from './Grid.module.css';

interface CellProps {
  cell: CellType;
  value: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isIncorrect: boolean;
  isCorrect: boolean;
  remoteCursors?: RoomPresence[];
  remoteHighlightColor?: string;
  remoteSelectedColor?: string;
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
  isCorrect,
  remoteCursors = [],
  remoteHighlightColor,
  remoteSelectedColor,
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
    isCorrect && styles.cellCorrect,
    cell.isCircled && styles.cellCircled,
    cell.isShaded && styles.cellShaded,
  ]
    .filter(Boolean)
    .join(' ');

  // Remote cursor styling
  const hasRemoteCursor = remoteCursors.length > 0;
  const remoteBorderColor = hasRemoteCursor ? remoteCursors[0].color : undefined;
  const remoteCursorStyle: React.CSSProperties = {};
  if (hasRemoteCursor) {
    remoteCursorStyle.boxShadow = `inset 0 0 0 3px ${remoteBorderColor}`;
    remoteCursorStyle.zIndex = 2;
  }
  // Remote selected cell: solid color like the local yellow
  if (remoteSelectedColor && hasRemoteCursor) {
    remoteCursorStyle.backgroundColor = remoteSelectedColor;
  }
  // Remote word highlight: pastel tint for the rest of the word
  else if (remoteHighlightColor) {
    remoteCursorStyle.backgroundColor = remoteHighlightColor;
  }

  return (
    <div className={cellClasses} onClick={onClick} role="gridcell" style={remoteCursorStyle}>
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
      {isCorrect && <div className={styles.cellCorrectMark} aria-hidden="true" />}
      {hasRemoteCursor && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -14,
            left: 0,
            fontSize: 9,
            fontWeight: 600,
            color: '#fff',
            background: remoteBorderColor,
            padding: '0 3px',
            borderRadius: '2px 2px 0 0',
            lineHeight: '14px',
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {remoteCursors[0].displayName.split(' ')[0]}
        </span>
      )}
    </div>
  );
};

export default Cell;
