import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePuzzle } from './PuzzleContext';
import { useAuth } from './AuthContext';
import { useAbly } from '../hooks/useAbly';
import { roomsApi } from '../api/roomsApi';
import type { Room, RoomMember, RoomPresence, RoomEvent } from '../types/room';
import { debounce } from '../utils/debounce';

interface RoomContextType {
  room: Room | null;
  myMember: RoomMember | null;
  presenceList: RoomPresence[];
  isConnected: boolean;
  isInRoom: boolean;
  createRoom: (puzzleId: string, puzzleData: Record<string, unknown>) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = usePuzzle();
  const { user, isAuthenticated } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [myMember, setMyMember] = useState<RoomMember | null>(null);
  const [presenceList, setPresenceList] = useState<RoomPresence[]>([]);

  // Debounced state persistence to DB (every 5 seconds)
  const persistStateRef = useRef(
    debounce((code: string, userGrid: Map<string, string>, checkedCells: Map<string, boolean>, accumulatedSeconds: number, isComplete: boolean, isPaused: boolean, timerStartedAt: string | null) => {
      roomsApi.updateRoomState(code, {
        userGrid: Array.from(userGrid.entries()),
        checkedCells: Array.from(checkedCells.entries()),
        accumulatedSeconds,
        isComplete,
        isPaused,
        timerStartedAt,
      }).catch(err => console.error('Failed to persist room state:', err));
    }, 5000)
  );

  // Handle incoming Ably events — dispatch to PuzzleContext with _fromRemote flag
  // to prevent re-broadcasting (React 18 batching makes ref-based suppression unreliable)
  const handleEvent = useCallback((event: RoomEvent) => {
    switch (event.type) {
      case 'cell_edit':
        dispatch({
          type: 'SET_CELL_VALUE',
          payload: { row: event.row, col: event.col, value: event.value, _fromRemote: true },
        });
        break;
      case 'check_cell':
        dispatch({
          type: 'CHECK_CELL',
          payload: { row: event.row, col: event.col, isCorrect: event.isCorrect, _fromRemote: true },
        });
        break;
      case 'clear_checks':
        dispatch({ type: 'CLEAR_CHECKS', _fromRemote: true });
        break;
      case 'timer_toggle':
        dispatch({
          type: 'SET_ROOM_TIMER',
          payload: {
            isPaused: event.isPaused,
            accumulatedSeconds: event.accumulatedSeconds,
            timerStartedAt: event.startedAt,
          },
        });
        break;
      case 'puzzle_complete':
        dispatch({ type: 'SET_COMPLETE', payload: true, _fromRemote: true });
        break;
      case 'state_sync':
        dispatch({
          type: 'LOAD_ROOM_STATE',
          payload: {
            userGrid: event.userGrid,
            checkedCells: event.checkedCells,
            accumulatedSeconds: event.accumulatedSeconds,
            isComplete: event.isComplete,
          },
        });
        break;
    }
  }, [dispatch]);

  const handlePresenceUpdate = useCallback((members: RoomPresence[]) => {
    setPresenceList(members);
  }, []);

  const { publish, updatePresence, isConnected } = useAbly({
    roomCode: room?.code ?? null,
    userId: user?.id ?? '',
    displayName: user?.name ?? '',
    color: myMember?.color ?? '#4A90D9',
    onEvent: handleEvent,
    onPresenceUpdate: handlePresenceUpdate,
  });

  // Expose publish to PuzzleContext via collaborative dispatch
  useEffect(() => {
    if (!room) {
      dispatch({ type: 'SET_COLLABORATIVE', payload: { isCollaborative: false } });
      return;
    }

    dispatch({
      type: 'SET_COLLABORATIVE',
      payload: {
        isCollaborative: true,
        collaborativeDispatch: (action: { type: string; payload?: unknown }) => {
          const ts = Date.now();
          const uid = user?.id ?? '';

          switch (action.type) {
            case 'SET_CELL_VALUE': {
              const p = action.payload as { row: number; col: number; value: string };
              publish({ type: 'cell_edit', row: p.row, col: p.col, value: p.value, userId: uid, timestamp: ts });
              break;
            }
            case 'CHECK_CELL': {
              const p = action.payload as { row: number; col: number; isCorrect: boolean };
              publish({ type: 'check_cell', row: p.row, col: p.col, isCorrect: p.isCorrect, userId: uid, timestamp: ts });
              break;
            }
            case 'CLEAR_CHECKS':
              publish({ type: 'clear_checks', userId: uid, timestamp: ts });
              break;
            case 'SET_COMPLETE': {
              const val = action.payload as boolean;
              if (val) {
                publish({ type: 'puzzle_complete', userId: uid, timestamp: ts });
              }
              break;
            }
          }
        },
        roomTimerData: {
          accumulatedSeconds: room.accumulatedSeconds,
          timerStartedAt: room.timerStartedAt,
          isPaused: room.isPaused,
        },
      },
    });
  }, [room, dispatch, publish, user?.id]);

  // Update presence when selection changes
  useEffect(() => {
    if (room && state.selection) {
      updatePresence(state.selection);
    }
  }, [room, state.selection, updatePresence]);

  // Persist state to DB periodically
  useEffect(() => {
    if (!room) return;
    persistStateRef.current(
      room.code,
      state.userGrid,
      state.checkedCells,
      state.elapsedSeconds,
      state.isComplete,
      state.isPaused,
      null, // timerStartedAt computed from room state
    );
  }, [room, state.userGrid, state.checkedCells, state.elapsedSeconds, state.isComplete, state.isPaused]);

  // Check URL for room code on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && !room) {
      joinRoom(roomCode);
    }
  }, [isAuthenticated]);

  const createRoom = useCallback(async (puzzleId: string, puzzleData: Record<string, unknown>) => {
    const roomData = await roomsApi.createRoom({ puzzle_id: puzzleId, puzzle_data: puzzleData });
    setRoom(roomData);
    // Creator is always first member
    if (roomData.members.length > 0) {
      const me = roomData.members.find((m: RoomMember) => m.userId === user?.id) || roomData.members[0];
      setMyMember(me);
    }
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomData.code);
    window.history.replaceState({}, '', url.toString());
  }, [user?.id]);

  const joinRoom = useCallback(async (code: string) => {
    const result = await roomsApi.joinRoom(code.toUpperCase());
    setRoom(result.room);
    setMyMember(result.member);

    // Load the puzzle for this room
    const roomState = await roomsApi.getRoomState(code.toUpperCase());

    // First load the puzzle
    const puzzleData = roomState.puzzleData || result.room.puzzleData;
    dispatch({
      type: 'SET_PUZZLE',
      payload: {
        puzzle: puzzleData as any,
        puzzleId: result.room.puzzleId,
      },
    });

    // Then load the shared room state on top
    if (roomState.userGrid.length > 0 || roomState.checkedCells.length > 0) {
      // Small delay to ensure SET_PUZZLE has been processed
      setTimeout(() => {
        dispatch({
          type: 'LOAD_ROOM_STATE',
          payload: {
            userGrid: roomState.userGrid,
            checkedCells: roomState.checkedCells,
            accumulatedSeconds: roomState.accumulatedSeconds,
            isComplete: roomState.isComplete,
          },
        });
      }, 50);
    }

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('room', code.toUpperCase());
    window.history.replaceState({}, '', url.toString());
  }, [dispatch]);

  const leaveRoom = useCallback(async () => {
    if (!room) return;
    try {
      await roomsApi.leaveRoom(room.code);
    } catch {
      // Room may already be gone
    }
    setRoom(null);
    setMyMember(null);
    setPresenceList([]);
    dispatch({ type: 'SET_COLLABORATIVE', payload: { isCollaborative: false } });

    // Remove room from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }, [room, dispatch]);

  const value: RoomContextType = {
    room,
    myMember,
    presenceList,
    isConnected,
    isInRoom: room !== null,
    createRoom,
    joinRoom,
    leaveRoom,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom(): RoomContextType {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }
  return context;
}
