import axios from 'axios';
import type { PuzzleResponse } from '../types/puzzle';

// API base URL - empty string = same origin (Vercel), fallback to localhost for dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies with every request
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export { apiClient };

export const puzzleApi = {
  async getPuzzleByDate(date: string): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>(`/api/puzzles/${date}`);
    return response.data;
  },

  async getRandomPuzzle(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/random/puzzle');
    return response.data;
  },

  async getRandomMiniPuzzle(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/random/mini');
    return response.data;
  },

  async getTodayHistorical(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/today/historical');
    return response.data;
  },

  async getTodaysLivePuzzle(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/today/live');
    return response.data;
  },

  async getTodaysMiniPuzzle(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/today/mini');
    return response.data;
  },

  async getMiniPuzzleByDate(date: string): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>(`/api/puzzles/mini/${date}`);
    return response.data;
  },

  async checkAnswers(date: string, userAnswers: { across: Record<string, string>; down: Record<string, string> }) {
    const response = await apiClient.post(`/api/puzzles/${date}/check`, userAnswers);
    return response.data;
  },

  async revealAnswers(date: string, revealType: 'letter' | 'word' | 'puzzle', clueNumber?: number) {
    const response = await apiClient.post(`/api/puzzles/${date}/reveal`, {
      reveal_type: revealType,
      clue_number: clueNumber,
    });
    return response.data;
  },
};

export default apiClient;
