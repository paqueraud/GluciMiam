import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import './assets/styles/theme.css';
import BurgerMenu from './components/layout/BurgerMenu';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import UserForm from './components/user/UserForm';
import LLMSettings from './components/settings/LLMSettings';
import ImportExport from './components/settings/ImportExport';
import AboutPage from './pages/AboutPage';
import HelpPage from './pages/HelpPage';
import { useAppStore } from './stores/appStore';
import { db } from './db';
import type { UserProfile } from './types';

type Page = 'home' | 'session' | 'new-user' | 'edit-user' | 'llm-settings' | 'import' | 'export' | 'about' | 'help';

function App() {
  const [page, setPage] = useState<Page>('home');
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const { loadUsers, users } = useAppStore();

  const navigate = useCallback((target: string) => {
    if (target === 'edit-user') {
      // Show user selector first if needed
      if (users.length === 1) {
        setEditUserId(users[0].id!);
      } else {
        setEditUserId(null);
      }
    }
    setPage(target as Page);
  }, [users]);

  const handleUserSaved = async () => {
    await loadUsers();
    setPage('home');
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <BurgerMenu onNavigate={navigate} />

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          style={{ height: '100%' }}
        >
          {page === 'home' && <HomePage onNavigate={navigate} />}
          {page === 'session' && <SessionPage onNavigate={navigate} />}
          {page === 'new-user' && (
            <UserForm onSaved={handleUserSaved} onCancel={() => setPage('home')} />
          )}
          {page === 'edit-user' && (
            <EditUserPage
              editUserId={editUserId}
              setEditUserId={setEditUserId}
              onSaved={handleUserSaved}
              onCancel={() => setPage('home')}
            />
          )}
          {page === 'llm-settings' && <LLMSettings onClose={() => setPage('home')} />}
          {page === 'import' && <ImportExport mode="import" onClose={() => setPage('home')} />}
          {page === 'export' && <ImportExport mode="export" onClose={() => setPage('home')} />}
          {page === 'about' && <AboutPage onClose={() => setPage('home')} />}
          {page === 'help' && <HelpPage onClose={() => setPage('home')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Sub-component for user editing with selection
function EditUserPage({
  editUserId,
  setEditUserId,
  onSaved,
  onCancel,
}: {
  editUserId: number | null;
  setEditUserId: (id: number | null) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { users, deleteUser, loadUsers } = useAppStore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // If we have a user ID, load it
  if (editUserId && !user) {
    db.users.get(editUserId).then((u) => {
      if (u) setUser(u);
    });
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      await deleteUser(id);
      await loadUsers();
      setConfirmDeleteId(null);
      if (editUserId === id) {
        setEditUserId(null);
        setUser(null);
      }
    } else {
      setConfirmDeleteId(id);
    }
  };

  if (!editUserId) {
    return (
      <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 20,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Modifier un profil
        </h2>
        {users.map((u) => (
          <div
            key={u.id}
            style={{ position: 'relative', marginBottom: 8 }}
          >
            <button
              onClick={() => setEditUserId(u.id!)}
              className="glass"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 16px',
                paddingRight: 48,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {u.name} - {u.age} ans
            </button>
            <button
              onClick={(e) => handleDelete(u.id!, e)}
              title={confirmDeleteId === u.id ? 'Confirmer' : 'Supprimer'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                color: confirmDeleteId === u.id ? 'var(--danger)' : 'var(--text-muted)',
                zIndex: 2,
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button className="btn btn-secondary" onClick={onCancel} style={{ width: '100%', marginTop: 16 }}>
          Retour
        </button>
      </div>
    );
  }

  if (!user) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  }

  return <UserForm existingUser={user} onSaved={onSaved} onCancel={onCancel} />;
}

export default App;
