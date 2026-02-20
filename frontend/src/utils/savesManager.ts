// Centralized localStorage manager for puzzle saves

import type { Puzzle } from '../types/puzzle';
import type { SaveData, SaveMetadata, SavesIndex } from '../types/saves';
import { debounce } from './debounce';
import { savesApi } from '../api/savesApi';

const SAVES_INDEX_KEY = 'crossword-saves-index';
const SAVE_KEY_PREFIX = 'crossword-save-';
const SAVE_VERSION = '1.0';

// Legacy keys for migration
const LEGACY_PUZZLE_PREFIX = 'puzzle-';
const LEGACY_TIME_PREFIX = 'puzzle-time-';

class SavesManager {
  private static instance: SavesManager;
  private _authToken: string | null = null;

  private constructor() {
    // Private constructor for singleton
    this.flushPendingSavesOnUnload();
  }

  /**
   * Set auth token to enable API saves (called by AuthContext)
   */
  setAuthToken(token: string | null): void {
    this._authToken = token;
  }

  get isAuthenticated(): boolean {
    return this._authToken !== null;
  }

  static getInstance(): SavesManager {
    if (!SavesManager.instance) {
      SavesManager.instance = new SavesManager();
    }
    return SavesManager.instance;
  }

  /**
   * Save puzzle progress with metadata
   */
  savePuzzleProgress(
    puzzleId: string,
    userGrid: Map<string, string>,
    checkedCells: Map<string, boolean>,
    elapsedSeconds: number,
    isComplete: boolean,
    puzzle: Puzzle
  ): void {
    try {
      // Calculate metadata
      const totalCells = puzzle.grid.filter(cell => cell !== '.').length;
      const cellsFilled = Array.from(userGrid.values()).filter(val => val !== '').length;
      const completionPercent = totalCells > 0 ? Math.round((cellsFilled / totalCells) * 100) : 0;

      const now = new Date().toISOString();

      // Create save data
      const saveData: SaveData = {
        version: SAVE_VERSION,
        puzzleId,
        userGrid: Array.from(userGrid.entries()),
        checkedCells: Array.from(checkedCells.entries()),
        elapsedSeconds,
        isComplete,
        lastPlayed: now,
        puzzle,
      };

      // Save puzzle data
      localStorage.setItem(`${SAVE_KEY_PREFIX}${puzzleId}`, JSON.stringify(saveData));

      // Update saves index
      const index = this.getSavesIndex();
      const existingMetadata = index.saves[puzzleId];

      const metadata: SaveMetadata = {
        puzzleId,
        date: puzzle.date || puzzleId,
        dateStarted: existingMetadata?.dateStarted || now,
        lastPlayed: now,
        completionPercent,
        elapsedSeconds,
        isComplete,
        cellsFilled,
        totalCells,
      };

      index.saves[puzzleId] = metadata;
      localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));

      // Also save to API if authenticated (fire and forget)
      if (this.isAuthenticated) {
        savesApi.upsertSave(puzzleId, {
          user_grid: Array.from(userGrid.entries()),
          checked_cells: Array.from(checkedCells.entries()),
          elapsed_seconds: elapsedSeconds,
          is_complete: isComplete,
          cells_filled: cellsFilled,
          total_cells: totalCells,
          completion_pct: completionPercent,
          puzzle_date: puzzle.date || puzzleId,
        }).catch(err => console.error('Error saving to server:', err));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Consider cleaning up old saves.');
      } else {
        console.error('Error saving puzzle progress:', error);
      }
    }
  }

  /**
   * Debounced save for grid changes (500ms delay)
   */
  debouncedSaveProgress = debounce(
    (
      puzzleId: string,
      userGrid: Map<string, string>,
      checkedCells: Map<string, boolean>,
      elapsedSeconds: number,
      isComplete: boolean,
      puzzle: Puzzle
    ) => {
      this.savePuzzleProgress(puzzleId, userGrid, checkedCells, elapsedSeconds, isComplete, puzzle);
    },
    500
  );

  /**
   * Load puzzle progress
   */
  loadPuzzleProgress(puzzleId: string): SaveData | null {
    try {
      const data = localStorage.getItem(`${SAVE_KEY_PREFIX}${puzzleId}`);
      if (!data) return null;

      const saveData: SaveData = JSON.parse(data);
      return saveData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Error parsing save data, attempting migration:', error);
        // Try to migrate from old format
        return this.migrateOldFormat(puzzleId);
      }
      console.error('Error loading puzzle progress:', error);
      return null;
    }
  }

  /**
   * Get the saves index with all metadata
   */
  getSavesIndex(): SavesIndex {
    try {
      const data = localStorage.getItem(SAVES_INDEX_KEY);
      if (!data) {
        return { version: SAVE_VERSION, saves: {} };
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading saves index:', error);
      return { version: SAVE_VERSION, saves: {} };
    }
  }

  /**
   * Get all save metadata as an array
   */
  getAllSaves(): SaveMetadata[] {
    const index = this.getSavesIndex();
    return Object.values(index.saves);
  }

  /**
   * Delete a save
   */
  deleteSave(puzzleId: string): void {
    try {
      // Remove puzzle data from localStorage
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${puzzleId}`);

      // Update index
      const index = this.getSavesIndex();
      delete index.saves[puzzleId];
      localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));

      // Also delete from API if authenticated
      if (this.isAuthenticated) {
        savesApi.deleteSave(puzzleId).catch(err => console.error('Error deleting from server:', err));
      }
    } catch (error) {
      console.error('Error deleting save:', error);
    }
  }

  /**
   * Delete all saves by IDs (awaits API deletions)
   */
  async deleteAllSaves(puzzleIds: string[]): Promise<void> {
    // Clear all from localStorage
    const index = this.getSavesIndex();
    for (const id of puzzleIds) {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${id}`);
      delete index.saves[id];
    }
    localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));

    // Delete all from API if authenticated
    if (this.isAuthenticated) {
      await Promise.all(
        puzzleIds.map(id => savesApi.deleteSave(id).catch(err => console.error('Error deleting from server:', err)))
      );
    }
  }

  /**
   * Clean up old abandoned saves
   */
  cleanupOldSaves(maxAgeInDays: number = 30): number {
    try {
      const now = Date.now();
      const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
      const index = this.getSavesIndex();
      let deletedCount = 0;

      Object.values(index.saves).forEach(metadata => {
        const lastPlayed = new Date(metadata.lastPlayed).getTime();
        const age = now - lastPlayed;

        // Delete if:
        // - Older than maxAge AND not started (0% complete)
        // - OR older than 90 days and not complete
        const shouldDelete =
          (age > maxAge && metadata.completionPercent === 0) ||
          (age > 90 * 24 * 60 * 60 * 1000 && !metadata.isComplete);

        if (shouldDelete) {
          this.deleteSave(metadata.puzzleId);
          deletedCount++;
        }
      });

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old saves:', error);
      return 0;
    }
  }

  /**
   * Get all saves from API (for authenticated users)
   */
  async getAllSavesFromApi(): Promise<SaveMetadata[]> {
    if (!this.isAuthenticated) return [];
    try {
      return await savesApi.listSaves();
    } catch {
      return [];
    }
  }

  /**
   * Export a single save as JSON
   */
  exportSave(puzzleId: string): string | null {
    try {
      const saveData = this.loadPuzzleProgress(puzzleId);
      if (!saveData) return null;

      const index = this.getSavesIndex();
      const metadata = index.saves[puzzleId];

      return JSON.stringify({ saveData, metadata }, null, 2);
    } catch (error) {
      console.error('Error exporting save:', error);
      return null;
    }
  }

  /**
   * Export all saves as JSON
   */
  exportAllSaves(): string {
    try {
      const index = this.getSavesIndex();
      const allSaves: Record<string, { saveData: SaveData | null; metadata: SaveMetadata }> = {};

      Object.keys(index.saves).forEach(puzzleId => {
        const saveData = this.loadPuzzleProgress(puzzleId);
        const metadata = index.saves[puzzleId];
        allSaves[puzzleId] = { saveData, metadata };
      });

      return JSON.stringify({ version: SAVE_VERSION, saves: allSaves }, null, 2);
    } catch (error) {
      console.error('Error exporting all saves:', error);
      return JSON.stringify({ version: SAVE_VERSION, saves: {} });
    }
  }

  /**
   * Import a save from JSON
   */
  importSave(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);

      // Check if it's a single save or multiple saves
      if (imported.saveData && imported.metadata) {
        // Single save
        const { saveData, metadata } = imported;
        localStorage.setItem(`${SAVE_KEY_PREFIX}${saveData.puzzleId}`, JSON.stringify(saveData));

        const index = this.getSavesIndex();
        index.saves[saveData.puzzleId] = metadata;
        localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));

        return true;
      } else if (imported.saves) {
        // Multiple saves
        const index = this.getSavesIndex();

        Object.entries(imported.saves).forEach(([puzzleId, data]: [string, any]) => {
          if (data.saveData && data.metadata) {
            localStorage.setItem(`${SAVE_KEY_PREFIX}${puzzleId}`, JSON.stringify(data.saveData));
            index.saves[puzzleId] = data.metadata;
          }
        });

        localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error importing save:', error);
      return false;
    }
  }

  /**
   * Migrate old format saves to new format
   */
  migrateOldFormat(puzzleId: string): SaveData | null {
    try {
      // Try to load old format
      const oldGridData = localStorage.getItem(`${LEGACY_PUZZLE_PREFIX}${puzzleId}`);

      if (!oldGridData) return null;

      // We don't have the puzzle data in old format, so we can't create a complete SaveData
      // This is a limitation - we'll need the puzzle to be loaded first
      console.log(`Found legacy save for ${puzzleId}, but migration requires puzzle data`);

      return null;
    } catch (error) {
      console.error('Error migrating old format:', error);
      return null;
    }
  }

  /**
   * Run migration for all old format saves
   */
  migrateAllOldSaves(): void {
    try {
      // Check if already migrated
      const index = this.getSavesIndex();
      if (Object.keys(index.saves).length > 0) {
        // Already have new format saves, skip migration
        return;
      }

      // Scan for old format keys
      const oldPuzzleKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LEGACY_PUZZLE_PREFIX)) {
          const puzzleId = key.replace(LEGACY_PUZZLE_PREFIX, '');
          oldPuzzleKeys.push(puzzleId);
        }
      }

      if (oldPuzzleKeys.length > 0) {
        console.log(`Found ${oldPuzzleKeys.length} old format saves. Migration will happen when puzzles are loaded.`);
      }
    } catch (error) {
      console.error('Error during migration check:', error);
    }
  }

  /**
   * Flush pending debounced saves before page unload
   */
  private flushPendingSavesOnUnload(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // Note: Debounced saves are already queued, they'll execute
        // This is here as a hook for future improvements
      });
    }
  }

  /**
   * Migrate a specific old save when puzzle is loaded
   */
  migrateOldSaveWithPuzzle(puzzleId: string, puzzle: Puzzle): boolean {
    try {
      const oldGridData = localStorage.getItem(`${LEGACY_PUZZLE_PREFIX}${puzzleId}`);
      const oldTimeData = localStorage.getItem(`${LEGACY_TIME_PREFIX}${puzzleId}`);

      if (!oldGridData) return false;

      // Parse old format
      const oldGrid: [string, string][] = JSON.parse(oldGridData);
      const elapsedSeconds = oldTimeData ? parseInt(oldTimeData, 10) : 0;

      // Convert to new format
      const userGrid = new Map(oldGrid);
      const checkedCells = new Map<string, boolean>(); // Old format didn't have this

      // Save in new format
      this.savePuzzleProgress(puzzleId, userGrid, checkedCells, elapsedSeconds, false, puzzle);

      console.log(`Successfully migrated old save for ${puzzleId}`);

      // Optionally remove old keys (keep for now as backup)
      // localStorage.removeItem(`${LEGACY_PUZZLE_PREFIX}${puzzleId}`);
      // localStorage.removeItem(`${LEGACY_TIME_PREFIX}${puzzleId}`);

      return true;
    } catch (error) {
      console.error('Error migrating old save with puzzle:', error);
      return false;
    }
  }
}

// Export singleton instance
export default SavesManager.getInstance();
