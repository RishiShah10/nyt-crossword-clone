import type { Selection } from './puzzle';

export interface Room {
  id: string;
  code: string;
  puzzleId: string;
  puzzleData: Record<string, unknown>;
  members: RoomMember[];
  isComplete: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  accumulatedSeconds: number;
  timerStartedAt: string | null;
  isPaused: boolean;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  color: string;
  joinedAt: string;
}

export interface RoomPresence {
  userId: string;
  displayName: string;
  color: string;
  selection: Selection | null;
}

export type RoomEvent =
  | { type: 'cell_edit'; row: number; col: number; value: string; userId: string; timestamp: number }
  | { type: 'check_cell'; row: number; col: number; isCorrect: boolean; userId: string; timestamp: number }
  | { type: 'clear_checks'; userId: string; timestamp: number }
  | { type: 'timer_toggle'; isPaused: boolean; accumulatedSeconds: number; startedAt: string | null; userId: string; timestamp: number }
  | { type: 'puzzle_complete'; userId: string; timestamp: number }
  | { type: 'state_sync'; userGrid: [string, string][]; checkedCells: [string, boolean][]; accumulatedSeconds: number; isComplete: boolean };
