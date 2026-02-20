import { useAuth } from '../../context/AuthContext';

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {user.avatar_url && (
        <img
          src={user.avatar_url}
          alt={user.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid #ddd',
          }}
          referrerPolicy="no-referrer"
        />
      )}
      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#333' }}>
        {user.name.split(' ')[0]}
      </span>
      <button
        onClick={logout}
        style={{
          padding: '3px 8px',
          fontSize: '0.7rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          background: '#fff',
          cursor: 'pointer',
          color: '#666',
        }}
      >
        Sign Out
      </button>
    </div>
  );
};

export default UserMenu;
