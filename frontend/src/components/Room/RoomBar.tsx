import React, { useState } from 'react';
import type { Room, RoomMember, RoomPresence } from '../../types/room';

interface RoomBarProps {
  room: Room;
  presenceList: RoomPresence[];
  onLeave: () => void;
}

const RoomBar: React.FC<RoomBarProps> = ({ room, presenceList, onLeave }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Merge members with presence (online status)
  const onlineUserIds = new Set(presenceList.map(p => p.userId));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '4px 16px',
      background: '#f0f4ff',
      borderBottom: '1px solid #d0d8f0',
      fontSize: '0.8rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 600, color: '#333' }}>Room:</span>
      <button
        onClick={copyCode}
        title="Copy room code"
        style={{
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: 2,
          background: copied ? '#4caf50' : '#fff',
          color: copied ? '#fff' : '#000',
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {copied ? 'Copied!' : room.code}
      </button>

      <span style={{ color: '#666', fontSize: '0.75rem' }}>|</span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {room.members.map((member: RoomMember) => {
          const isOnline = onlineUserIds.has(member.userId);
          return (
            <span
              key={member.userId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                opacity: isOnline ? 1 : 0.5,
              }}
              title={`${member.displayName}${isOnline ? ' (online)' : ' (offline)'}`}
            >
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: member.color,
                display: 'inline-block',
                border: isOnline ? '2px solid #fff' : '2px solid transparent',
                boxShadow: isOnline ? `0 0 0 1px ${member.color}` : 'none',
              }} />
              <span style={{ fontSize: '0.75rem', color: '#444', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.displayName.split(' ')[0]}
              </span>
            </span>
          );
        })}
      </div>

      <button
        onClick={onLeave}
        className="btn"
        style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px', color: '#d32f2f', borderColor: '#d32f2f' }}
      >
        Leave
      </button>
    </div>
  );
};

export default RoomBar;
