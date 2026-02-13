import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { motion } from 'framer-motion';
import { User, Plus, Trash2 } from 'lucide-react';

interface UserSelectorProps {
  onSelect: (userId: number) => void;
  onCreateNew: () => void;
}

export default function UserSelector({ onSelect, onCreateNew }: UserSelectorProps) {
  const { users, loadUsers, deleteUser } = useAppStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      await deleteUser(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

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
        <div
          key={user.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            width: '100%',
            position: 'relative',
          }}
        >
          <button
            onClick={() => onSelect(user.id!)}
            className="glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              paddingRight: 48,
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
          <button
            onClick={(e) => handleDelete(user.id!, e)}
            title={confirmDeleteId === user.id ? 'Confirmer la suppression' : 'Supprimer'}
            style={{
              position: 'absolute',
              right: 10,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: confirmDeleteId === user.id ? 'var(--danger)' : 'var(--text-muted)',
              transition: 'color var(--transition-fast)',
              zIndex: 2,
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
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
