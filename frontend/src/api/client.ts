import axios from 'axios';
import type { PuzzleResponse } from '../types/puzzle';

// API base URL - defaults to localhost backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // 90 seconds to handle Render free tier cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export { apiClient };

export const puzzleApi = {
  /**
   * Get puzzle by date
   */
  async getPuzzleByDate(date: string): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>(`/api/puzzles/${date}`);
    return response.data;
  },

  /**
   * Get random puzzle
   */
  async getRandomPuzzle(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/random/puzzle');
    return response.data;
  },

  /**
   * Get today's historical puzzle
   */
  async getTodayHistorical(): Promise<PuzzleResponse> {
    const response = await apiClient.get<PuzzleResponse>('/api/puzzles/today/historical');
    return response.data;
  },

  /**
   * Check puzzle answers
   */
  async checkAnswers(date: string, userAnswers: { across: Record<string, string>; down: Record<string, string> }) {
    const response = await apiClient.post(`/api/puzzles/${date}/check`, userAnswers);
    return response.data;
  },

  /**
   * Reveal puzzle answers
   */
  async revealAnswers(date: string, revealType: 'letter' | 'word' | 'puzzle', clueNumber?: number) {
    const response = await apiClient.post(`/api/puzzles/${date}/reveal`, {
      reveal_type: revealType,
      clue_number: clueNumber,
    });
    return response.data;
  },
};

export default apiClient;
