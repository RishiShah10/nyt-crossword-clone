// Individual puzzle card component for the library

import React from 'react';
import type { SaveMetadata } from '../../types/saves';
import styles from './PuzzleLibrary.module.css';

interface PuzzleCardProps {
  metadata: SaveMetadata;
  onResume: (puzzleId: string) => void;
  onDelete: (puzzleId: string) => void;
  onExport: (puzzleId: string) => void;
}

const PuzzleCard: React.FC<PuzzleCardProps> = ({ metadata, onResume, onDelete, onExport }) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const getProgressColor = (percent: number): string => {
    if (percent === 100) return '#4caf50'; // Green
    if (percent >= 50) return '#2196f3'; // Blue
    if (percent >= 25) return '#ff9800'; // Orange
    return '#9e9e9e'; // Gray
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete save for ${metadata.date}?`)) {
      onDelete(metadata.puzzleId);
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExport(metadata.puzzleId);
  };

  return (
    <div className={styles.puzzleCard} onClick={() => onResume(metadata.puzzleId)}>
      <div className={styles.cardHeader}>
        <div className={styles.puzzleDate}>{metadata.date}</div>
        {metadata.isComplete && <span className={styles.completeBadge}>✓ Complete</span>}
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${metadata.completionPercent}%`,
              backgroundColor: getProgressColor(metadata.completionPercent),
            }}
          />
        </div>
        <div className={styles.progressText}>{metadata.completionPercent}% complete</div>
      </div>

      <div className={styles.cardStats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Time:</span>
          <span className={styles.statValue}>{formatTime(metadata.elapsedSeconds)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Filled:</span>
          <span className={styles.statValue}>
            {metadata.cellsFilled}/{metadata.totalCells}
          </span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.lastPlayed}>Last played: {formatRelativeTime(metadata.lastPlayed)}</div>
        <div className={styles.cardActions}>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            title="Export save"
            aria-label="Export puzzle save"
          >
            ↓
          </button>
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            title="Delete save"
            aria-label="Delete puzzle save"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default PuzzleCard;
