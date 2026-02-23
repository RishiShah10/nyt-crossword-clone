import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';

const JoinRoom: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { joinRoom } = useRoom();
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    if (!isAuthenticated) {
      setError('Sign in to join a room');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      await joinRoom(trimmed);
      setShowInput(false);
      setCode('');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status: number; data?: { detail?: string } } };
        if (axiosErr.response?.status === 404) {
          setError('Room not found');
        } else if (axiosErr.response?.status === 409) {
          setError('Room is full');
        } else if (axiosErr.response?.status === 410) {
          setError('Room has expired');
        } else {
          setError(axiosErr.response?.data?.detail || 'Failed to join');
        }
      } else {
        setError('Failed to join room');
      }
    } finally {
      setIsJoining(false);
    }
  };

  if (!showInput) {
    return (
      <button
        className="btn btn-check"
        onClick={() => setShowInput(true)}
        disabled={!isAuthenticated}
        title={!isAuthenticated ? 'Sign in to join a room' : 'Join a collaborative room'}
      >
        Join Room
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase().slice(0, 6));
          setError(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        placeholder="ABC123"
        maxLength={6}
        style={{
          width: 72,
          padding: '4px 6px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          border: '1px solid #ccc',
          borderRadius: 4,
          textAlign: 'center',
          letterSpacing: 1,
        }}
        autoFocus
      />
      <button className="btn btn-check" onClick={handleJoin} disabled={isJoining}>
        {isJoining ? '...' : 'Go'}
      </button>
      <button
        className="btn"
        onClick={() => { setShowInput(false); setCode(''); setError(null); }}
        style={{ padding: '4px 6px', fontSize: '0.7rem' }}
      >
        X
      </button>
      {error && <span style={{ color: '#d32f2f', fontSize: '0.7rem' }}>{error}</span>}
    </span>
  );
};

export default JoinRoom;
