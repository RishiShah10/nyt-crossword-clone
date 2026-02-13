// Modal UI for browsing saved puzzles

import React, { useState, useEffect } from 'react';
import SavesManager from '../../utils/savesManager';
import type { SaveMetadata } from '../../types/saves';
import PuzzleCard from './PuzzleCard';
import styles from './PuzzleLibrary.module.css';

interface PuzzleLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPuzzle: (puzzleId: string) => void;
}

type FilterType = 'all' | 'in-progress' | 'completed';
type SortType = 'last-played' | 'date' | 'completion';

const PuzzleLibrary: React.FC<PuzzleLibraryProps> = ({ isOpen, onClose, onSelectPuzzle }) => {
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('last-played');

  useEffect(() => {
    if (isOpen) {
      loadSaves();
    }
  }, [isOpen]);

  const loadSaves = () => {
    const allSaves = SavesManager.getAllSaves();
    setSaves(allSaves);
  };

  const handleDelete = (puzzleId: string) => {
    SavesManager.deleteSave(puzzleId);
    loadSaves();
  };

  const handleExport = (puzzleId: string) => {
    const json = SavesManager.exportSave(puzzleId);
    if (!json) {
      alert('Failed to export save');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crossword-save-${puzzleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const json = SavesManager.exportAllSaves();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crossword-saves-all-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        if (SavesManager.importSave(json)) {
          alert('Save imported successfully!');
          loadSaves();
        } else {
          alert('Failed to import save. Invalid format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleCleanup = () => {
    const count = SavesManager.cleanupOldSaves(30);
    alert(`Cleaned up ${count} old save${count !== 1 ? 's' : ''}`);
    loadSaves();
  };

  const getFilteredSaves = (): SaveMetadata[] => {
    let filtered = [...saves];

    // Apply filter
    if (filter === 'in-progress') {
      filtered = filtered.filter(s => !s.isComplete && s.completionPercent > 0);
    } else if (filter === 'completed') {
      filtered = filtered.filter(s => s.isComplete);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'last-played':
          return new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime();
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'completion':
          return b.completionPercent - a.completionPercent;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const handleResume = (puzzleId: string) => {
    onSelectPuzzle(puzzleId);
    onClose();
  };

  if (!isOpen) return null;

  const filteredSaves = getFilteredSaves();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Puzzle Library</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close library">
            ×
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.filterGroup}>
            <label>Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as FilterType)}>
              <option value="all">All</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className={styles.sortGroup}>
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}>
              <option value="last-played">Last Played</option>
              <option value="date">Puzzle Date</option>
              <option value="completion">Completion %</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={handleImport}>
              Import
            </button>
            <button className={styles.actionBtn} onClick={handleExportAll}>
              Export All
            </button>
            <button className={styles.actionBtn} onClick={handleCleanup}>
              Clean Up
            </button>
          </div>
        </div>

        <div className={styles.savesCount}>
          {filteredSaves.length} save{filteredSaves.length !== 1 ? 's' : ''}
        </div>

        {filteredSaves.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No saved puzzles found</p>
            {filter !== 'all' && <p>Try changing the filter</p>}
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {filteredSaves.map((metadata) => (
              <PuzzleCard
                key={metadata.puzzleId}
                metadata={metadata}
                onResume={handleResume}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PuzzleLibrary;
