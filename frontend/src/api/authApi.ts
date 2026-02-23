import { apiClient } from './client';
import type { LoginResponse, User } from '../types/auth';

export const authApi = {
  loginWithGoogle: async (credential: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/api/auth/google', { credential });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },
};
