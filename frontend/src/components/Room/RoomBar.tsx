import React, { useState, useRef, useEffect } from 'react';
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
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const onlineUserIds = new Set(presenceList.map(p => p.userId));
  const takenColors = new Set(
    room.members.filter(m => m.userId !== myMember?.userId).map(m => m.color)
  );
  const myColor = myMember?.color;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 16px',
      background: '#fafafa',
      borderBottom: '1px solid #e0e0e0',
      fontSize: '0.8rem',
      flexWrap: 'wrap',
    }}>
      {/* Room code */}
      <span style={{ fontWeight: 600, color: '#333', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Room</span>
      <button
        onClick={copyCode}
        title="Click to copy room code"
        style={{
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: 2,
          background: copied ? '#2e7d32' : '#fff',
          color: copied ? '#fff' : '#000',
          border: '1px solid #d0d0d0',
          borderRadius: 4,
          padding: '3px 10px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {copied ? 'Copied!' : room.code}
      </button>

      <div style={{ width: 1, height: 18, background: '#d0d0d0' }} />

      {/* Members */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {room.members.map((member: RoomMember) => {
          const isOnline = onlineUserIds.has(member.userId);
          const isMe = member.userId === myMember?.userId;
          return (
            <span
              key={member.userId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                opacity: isOnline ? 1 : 0.4,
              }}
              title={`${member.displayName}${isMe ? ' (you)' : ''}${isOnline ? '' : ' - offline'}`}
            >
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: member.color,
                display: 'inline-block',
                flexShrink: 0,
                boxShadow: isOnline ? `0 0 0 1.5px #fff, 0 0 0 2.5px ${member.color}` : 'none',
              }} />
              <span style={{
                fontSize: '0.75rem',
                color: '#333',
                fontWeight: isMe ? 600 : 400,
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {member.displayName.split(' ')[0]}{isMe ? ' (you)' : ''}
              </span>
            </span>
          );
        })}
      </div>

      <div style={{ width: 1, height: 18, background: '#d0d0d0' }} />

      {/* Color picker */}
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Change your color"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: showPicker ? '#f0f0f0' : '#fff',
            border: '1px solid #d0d0d0',
            borderRadius: 4,
            padding: '3px 10px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: '#333',
            transition: 'background 0.15s',
          }}
        >
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: myColor || '#4A90D9',
            display: 'inline-block',
            border: '1.5px solid rgba(0,0,0,0.15)',
            flexShrink: 0,
          }} />
          <span>Color</span>
          <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>{showPicker ? '\u25B2' : '\u25BC'}</span>
        </button>

        {showPicker && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            zIndex: 100,
            minWidth: 160,
          }}>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}>
              Choose color
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              justifyItems: 'center',
            }}>
              {ALL_COLORS.map(({ hex, label }) => {
                const isActive = hex === myColor;
                const isTaken = takenColors.has(hex);
                return (
                  <button
                    key={hex}
                    onClick={() => {
                      if (!isTaken) {
                        onChangeColor(hex);
                        setShowPicker(false);
                      }
                    }}
                    title={isTaken ? `${label} (in use)` : label}
                    disabled={isTaken}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: hex,
                      border: isActive
                        ? '2.5px solid #000'
                        : '2px solid rgba(0,0,0,0.08)',
                      cursor: isTaken ? 'not-allowed' : 'pointer',
                      opacity: isTaken ? 0.25 : 1,
                      outline: 'none',
                      padding: 0,
                      transition: 'all 0.15s',
                      transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: isActive
                        ? '0 0 0 2px #fff, 0 0 0 3.5px #000'
                        : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isTaken && !isActive) {
                        (e.target as HTMLElement).style.transform = 'scale(1.15)';
                        (e.target as HTMLElement).style.boxShadow = `0 2px 8px ${hex}66`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.target as HTMLElement).style.transform = 'scale(1)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leave button */}
      <button
        onClick={onLeave}
        style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          padding: '3px 10px',
          color: '#999',
          background: 'transparent',
          border: '1px solid #d0d0d0',
          borderRadius: 4,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.color = '#d32f2f';
          (e.target as HTMLElement).style.borderColor = '#d32f2f';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.color = '#999';
          (e.target as HTMLElement).style.borderColor = '#d0d0d0';
        }}
      >
        Leave
      </button>
    </div>
  );
};

export default RoomBar;
