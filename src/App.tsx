import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './assets/styles/theme.css';
import BurgerMenu from './components/layout/BurgerMenu';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import UserForm from './components/user/UserForm';
import LLMSettings from './components/settings/LLMSettings';
import ImportExport from './components/settings/ImportExport';
import { useAppStore } from './stores/appStore';
import { db } from './db';

type Page = 'home' | 'session' | 'new-user' | 'edit-user' | 'llm-settings' | 'import' | 'export';

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
  const { users } = useAppStore();
  const [user, setUser] = useState<Awaited<ReturnType<typeof db.users.get>> | null>(null);

  // If we have a user ID, load it
  if (editUserId && !user) {
    db.users.get(editUserId).then((u) => {
      if (u) setUser(u);
    });
  }

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
          <button
            key={u.id}
            onClick={() => setEditUserId(u.id!)}
            className="glass"
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 16px',
              marginBottom: 8,
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
