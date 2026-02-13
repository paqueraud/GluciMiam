import { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { motion } from 'framer-motion';
import { User, Plus } from 'lucide-react';

interface UserSelectorProps {
  onSelect: (userId: number) => void;
  onCreateNew: () => void;
}

export default function UserSelector({ onSelect, onCreateNew }: UserSelectorProps) {
  const { users, loadUsers } = useAppStore();

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        width: '100%',
        maxWidth: 400,
      }}
    >
      <h3 style={{
        fontSize: 16,
        fontWeight: 700,
        textAlign: 'center',
        color: 'var(--text-primary)',
        marginBottom: 4,
      }}>
        Sélectionnez un profil
      </h3>

      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.id!)}
          className="glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 500,
            transition: 'all var(--transition-fast)',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.boxShadow = 'var(--accent-glow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {user.age} ans - Index: {user.fingerLengthMm}mm
            </div>
          </div>
        </button>
      ))}

      <button
        onClick={onCreateNew}
        className="btn btn-secondary"
        style={{
          padding: '14px 16px',
          gap: 8,
        }}
      >
        <Plus size={18} />
        Nouveau profil
      </button>
    </motion.div>
  );
}
