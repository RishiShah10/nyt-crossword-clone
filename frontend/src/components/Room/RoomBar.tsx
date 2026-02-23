import React, { useState } from 'react';
import type { Room, RoomMember, RoomPresence } from '../../types/room';

const ALL_COLORS = [
  { hex: '#4A90D9', label: 'Blue' },
  { hex: '#E74C3C', label: 'Red' },
  { hex: '#2ECC71', label: 'Green' },
  { hex: '#9B59B6', label: 'Purple' },
  { hex: '#F39C12', label: 'Orange' },
  { hex: '#1ABC9C', label: 'Teal' },
  { hex: '#E91E63', label: 'Pink' },
  { hex: '#3F51B5', label: 'Indigo' },
];

interface RoomBarProps {
  room: Room;
  myMember: RoomMember | null;
  presenceList: RoomPresence[];
  onLeave: () => void;
  onChangeColor: (color: string) => void;
}

const RoomBar: React.FC<RoomBarProps> = ({ room, myMember, presenceList, onLeave, onChangeColor }) => {
  const [copied, setCopied] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const onlineUserIds = new Set(presenceList.map(p => p.userId));
  const takenColors = new Set(room.members.map(m => m.color));
  const myColor = myMember?.color;

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
      position: 'relative',
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

      <span style={{ color: '#666', fontSize: '0.75rem' }}>|</span>

      {/* Color picker toggle */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Change your color"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: '#444',
          }}
        >
          <span style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: myColor || '#4A90D9',
            display: 'inline-block',
            border: '1px solid rgba(0,0,0,0.2)',
          }} />
          Color
        </button>

        {showPicker && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d0d8f0',
            borderRadius: 6,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            minWidth: 140,
          }}>
            {ALL_COLORS.map(({ hex, label }) => {
              const isActive = hex === myColor;
              const isTaken = takenColors.has(hex) && !isActive;
              return (
                <button
                  key={hex}
                  onClick={() => {
                    if (!isTaken) {
                      onChangeColor(hex);
                      setShowPicker(false);
                    }
                  }}
                  title={isTaken ? `${label} (taken)` : label}
                  disabled={isTaken}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: hex,
                    border: isActive ? '3px solid #000' : '2px solid rgba(0,0,0,0.1)',
                    cursor: isTaken ? 'not-allowed' : 'pointer',
                    opacity: isTaken ? 0.3 : 1,
                    outline: 'none',
                    padding: 0,
                    transition: 'transform 0.1s',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>
        )}
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
