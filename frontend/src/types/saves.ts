// Type definitions for enhanced save system

import type { Puzzle } from './puzzle';

export interface SaveMetadata {
  puzzleId: string;
  date: string;              // Puzzle date
  dateStarted: string;       // ISO timestamp
  lastPlayed: string;        // ISO timestamp
  completionPercent: number; // 0-100
  elapsedSeconds: number;
  isComplete: boolean;
  cellsFilled: number;
  totalCells: number;
}

export interface SavesIndex {
  version: string;
  saves: Record<string, SaveMetadata>;
}

export interface SaveData {
  version: string;
  puzzleId: string;
  userGrid: [string, string][];
  checkedCells: [string, boolean][];
  elapsedSeconds: number;
  isComplete: boolean;
  lastPlayed: string;
  puzzle: Puzzle; // Store full puzzle for offline access
}
