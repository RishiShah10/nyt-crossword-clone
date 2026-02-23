import { useEffect, useRef, useCallback, useState } from 'react';
import * as Ably from 'ably';
import { roomsApi } from '../api/roomsApi';
import type { RoomEvent, RoomPresence } from '../types/room';
import type { Selection } from '../types/puzzle';

interface UseAblyOptions {
  roomCode: string | null;
  userId: string;
  displayName: string;
  color: string;
  onEvent: (event: RoomEvent) => void;
  onPresenceUpdate: (members: RoomPresence[]) => void;
}

// Client-side rate limit: max 20 cell edits per second
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 1000;

export function useAbly({ roomCode, userId, displayName, color, onEvent, onPresenceUpdate }: UseAblyOptions) {
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Unique ID per tab so same-user-different-tab messages get through
  const tabIdRef = useRef(Math.random().toString(36).slice(2, 10));

  // Rate limiting state
  const editTimestampsRef = useRef<number[]>([]);
  const queueRef = useRef<RoomEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs to avoid reconnecting when these change
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const colorRef = useRef(color);
  colorRef.current = color;

  // Stable callback refs
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;

  // Connect to Ably and subscribe
  useEffect(() => {
    if (!roomCode) return;

    const channelName = `room:${roomCode}`;

    const client = new Ably.Realtime({
      authCallback: async (_params, callback) => {
        try {
          const tokenRequest = await roomsApi.getAblyToken(roomCode);
          callback(null, tokenRequest as Ably.TokenRequest);
        } catch (err) {
          callback(err as Ably.ErrorInfo, null);
        }
      },
      clientId: userId,
    });

    clientRef.current = client;

    client.connection.on('connected', () => setIsConnected(true));
    client.connection.on('disconnected', () => setIsConnected(false));
    client.connection.on('closed', () => setIsConnected(false));

    const channel = client.channels.get(channelName);
    channelRef.current = channel;

    // Subscribe to messages
    channel.subscribe((message: Ably.Message) => {
      // Ignore own messages (by tab ID, not user ID, so same-user-different-tab works)
      const data = message.data as RoomEvent & { _tabId?: string };
      if (data?._tabId === tabIdRef.current) return;
      if (data) {
        onEventRef.current(data);
      }
    });

    // Enter presence
    channel.presence.enter({
      userId,
      displayName: displayNameRef.current,
      color: colorRef.current,
      selection: null,
    });

    // Subscribe to presence changes
    const syncPresence = async () => {
      try {
        const members = await channel.presence.get();
        const presenceList: RoomPresence[] = members.map(m => m.data as RoomPresence);
        onPresenceUpdateRef.current(presenceList);
      } catch {
        // Presence may fail during reconnection
      }
    };

    channel.presence.subscribe('enter', syncPresence);
    channel.presence.subscribe('leave', syncPresence);
    channel.presence.subscribe('update', syncPresence);

    // Initial presence sync
    syncPresence();

    return () => {
      channel.presence.leave();
      channel.unsubscribe();
      channel.presence.unsubscribe();
      client.close();
      clientRef.current = null;
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [roomCode, userId]);

  // Publish an event with rate limiting
  const publish = useCallback((event: RoomEvent) => {
    const channel = channelRef.current;
    if (!channel) return;

    const now = Date.now();

    // Clean old timestamps
    editTimestampsRef.current = editTimestampsRef.current.filter(t => now - t < RATE_WINDOW_MS);

    if (event.type === 'cell_edit' && editTimestampsRef.current.length >= RATE_LIMIT) {
      // Queue and flush on next tick
      queueRef.current.push(event);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          const queue = queueRef.current;
          queueRef.current = [];
          flushTimerRef.current = null;
          // Only send the latest edit per cell
          const latest = new Map<string, RoomEvent>();
          for (const e of queue) {
            if (e.type === 'cell_edit') {
              latest.set(`${e.row},${e.col}`, e);
            }
          }
          for (const e of latest.values()) {
            channel.publish('event', { ...e, _tabId: tabIdRef.current });
          }
        }, 50);
      }
      return;
    }

    if (event.type === 'cell_edit') {
      editTimestampsRef.current.push(now);
    }

    channel.publish('event', { ...event, _tabId: tabIdRef.current });
  }, []);

  // Update presence (selection changes)
  const updatePresence = useCallback((selection: Selection | null) => {
    const channel = channelRef.current;
    if (!channel) return;

    channel.presence.update({
      userId,
      displayName: displayNameRef.current,
      color: colorRef.current,
      selection,
    });
  }, [userId]);

  return { publish, updatePresence, isConnected };
}
