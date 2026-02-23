import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import type { Puzzle } from '../../types/puzzle';

interface CreateRoomProps {
  puzzleId: string | null;
  puzzle: Puzzle | null;
}

const CreateRoom: React.FC<CreateRoomProps> = ({ puzzleId, puzzle }) => {
  const { isAuthenticated } = useAuth();
  const { createRoom } = useRoom();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!puzzleId || !puzzle) {
      setError('Load a puzzle first');
      return;
    }
    if (!isAuthenticated) {
      setError('Sign in to create a room');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createRoom(puzzleId, puzzle as unknown as Record<string, unknown>);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-check"
        onClick={handleCreate}
        disabled={isCreating || !isAuthenticated || !puzzleId}
        title={!isAuthenticated ? 'Sign in to create a room' : 'Create a collaborative room'}
      >
        {isCreating ? 'Creating...' : 'Create Room'}
      </button>
      {error && <span style={{ color: '#d32f2f', fontSize: '0.75rem', marginLeft: 4 }}>{error}</span>}
    </>
  );
};

export default CreateRoom;
