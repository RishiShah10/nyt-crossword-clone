import { apiClient } from './client';
import type { Room } from '../types/room';

export interface CreateRoomRequest {
  puzzle_id: string;
  puzzle_data: Record<string, unknown>;
}

export interface RoomStateResponse {
  userGrid: [string, string][];
  checkedCells: [string, boolean][];
  accumulatedSeconds: number;
  timerStartedAt: string | null;
  isComplete: boolean;
  isPaused: boolean;
  puzzleData: Record<string, unknown>;
}

export interface UpdateRoomStateRequest {
  userGrid?: [string, string][];
  checkedCells?: [string, boolean][];
  accumulatedSeconds?: number;
  timerStartedAt?: string | null;
  isComplete?: boolean;
  isPaused?: boolean;
}

export interface JoinRoomResponse {
  room: Room;
  member: { userId: string; displayName: string; color: string; joinedAt: string };
  already_joined?: boolean;
}

export const roomsApi = {
  createRoom: async (data: CreateRoomRequest): Promise<Room> => {
    const response = await apiClient.post('/api/rooms', data);
    return response.data;
  },

  getRoom: async (code: string): Promise<Room> => {
    const response = await apiClient.get(`/api/rooms/${code}`);
    return response.data;
  },

  joinRoom: async (code: string): Promise<JoinRoomResponse> => {
    const response = await apiClient.post(`/api/rooms/${code}/join`);
    return response.data;
  },

  leaveRoom: async (code: string): Promise<void> => {
    await apiClient.post(`/api/rooms/${code}/leave`);
  },

  getAblyToken: async (code: string): Promise<unknown> => {
    const response = await apiClient.post(`/api/rooms/${code}/token`);
    return response.data;
  },

  getRoomState: async (code: string): Promise<RoomStateResponse> => {
    const response = await apiClient.get(`/api/rooms/${code}/state`);
    return response.data;
  },

  updateRoomState: async (code: string, state: UpdateRoomStateRequest): Promise<void> => {
    await apiClient.put(`/api/rooms/${code}/state`, state);
  },

  updateColor: async (code: string, color: string): Promise<{ userId: string; displayName: string; color: string; joinedAt: string }> => {
    const response = await apiClient.put(`/api/rooms/${code}/color`, { color });
    return response.data;
  },
};
