import { apiClient } from './client';
import type { SaveMetadata } from '../types/saves';

export interface SaveRequestData {
  user_grid: [string, string][];
  checked_cells: [string, boolean][];
  elapsed_seconds: number;
  is_complete: boolean;
  cells_filled: number;
  total_cells: number;
  completion_pct: number;
  puzzle_date: string;
}

export const savesApi = {
  listSaves: async (): Promise<SaveMetadata[]> => {
    const response = await apiClient.get('/api/saves');
    return response.data;
  },

  getSave: async (puzzleId: string) => {
    const response = await apiClient.get(`/api/saves/${encodeURIComponent(puzzleId)}`);
    return response.data;
  },

  upsertSave: async (puzzleId: string, data: SaveRequestData) => {
    const response = await apiClient.put(`/api/saves/${encodeURIComponent(puzzleId)}`, data);
    return response.data;
  },

  deleteSave: async (puzzleId: string) => {
    const response = await apiClient.delete(`/api/saves/${encodeURIComponent(puzzleId)}`);
    return response.data;
  },

  bulkImport: async (saves: { puzzle_id: string; [key: string]: unknown }[]) => {
    const response = await apiClient.post('/api/saves/bulk', { saves });
    return response.data;
  },
};
