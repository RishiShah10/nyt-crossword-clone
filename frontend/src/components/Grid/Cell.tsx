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
  isPencil: boolean;
  remoteCursors?: RoomPresence[];
  remoteHighlightColor?: string;
  remoteSelectedColor?: string;
  myHighlightColor?: string;   // Local player's word highlight color (in room mode)
  mySelectedColor?: string;    // Local player's selected cell color (in room mode)
  myCursorColor?: string;      // Local player's base color for borders/outlines (in room mode)
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
  isPencil,
  remoteCursors = [],
  remoteHighlightColor,
  remoteSelectedColor,
  myHighlightColor,
  mySelectedColor,
  myCursorColor,
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

  // In room mode, skip CSS highlight/selected classes — we override with inline colors
  const useCustomColors = !!(myHighlightColor || mySelectedColor);
  const cellClasses = [
    styles.cell,
    styles.cellWhite,
    isSelected && !useCustomColors && styles.cellSelected,
    isHighlighted && !useCustomColors && styles.cellHighlighted,
    isIncorrect && styles.cellIncorrect,
    isCorrect && styles.cellCorrect,
    isPencil && styles.cellPencil,
    cell.isCircled && styles.cellCircled,
    cell.isShaded && styles.cellShaded,
  ]
    .filter(Boolean)
    .join(' ');

  // Build combined inline style for all color overrides
  const cellStyle: React.CSSProperties = {};

  // Local player color overrides (room mode)
  if (useCustomColors) {
    if (isSelected && mySelectedColor) {
      cellStyle.backgroundColor = mySelectedColor;
      cellStyle.boxShadow = `inset 0 0 0 2px ${myCursorColor || mySelectedColor}`;
      cellStyle.zIndex = 1;
    } else if (isHighlighted && myHighlightColor) {
      cellStyle.backgroundColor = myHighlightColor;
    }
  }

  // Remote cursor styling
  const hasRemoteCursor = remoteCursors.length > 0;
  const remoteBorderColor = hasRemoteCursor ? remoteCursors[0].color : undefined;
  if (hasRemoteCursor) {
    cellStyle.boxShadow = `inset 0 0 0 3px ${remoteBorderColor}`;
    cellStyle.zIndex = 2;
  }
  // Remote selected cell: solid color
  if (remoteSelectedColor && hasRemoteCursor) {
    cellStyle.backgroundColor = remoteSelectedColor;
  }
  // Remote word highlight: pastel tint for the rest of the word
  else if (remoteHighlightColor && !isHighlighted && !isSelected) {
    cellStyle.backgroundColor = remoteHighlightColor;
  }

  return (
    <div className={cellClasses} onClick={onClick} role="gridcell" style={cellStyle}>
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
        inputMode="text"
        aria-label={cell.number ? `Cell ${cell.number}` : 'Cell'}
        aria-invalid={isIncorrect}
        style={myCursorColor ? { outlineColor: myCursorColor } : undefined}
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
