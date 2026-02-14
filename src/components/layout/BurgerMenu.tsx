import { useAppStore } from '../../stores/appStore';
import { Menu, X, Bot, UserPlus, UserCog, Download, Upload, HelpCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BurgerMenuProps {
  onNavigate: (page: string) => void;
}

export default function BurgerMenu({ onNavigate }: BurgerMenuProps) {
  const { isMenuOpen, setMenuOpen } = useAppStore();

  const menuItems = [
    { id: 'llm-settings', label: 'Configuration LLM', icon: Bot },
    { id: 'new-user', label: 'Nouvel utilisateur', icon: UserPlus },
    { id: 'edit-user', label: 'Modifier utilisateur', icon: UserCog },
    { id: 'import', label: 'Importer BDD', icon: Download },
    { id: 'export', label: 'Exporter BDD', icon: Upload },
  ];

  const bottomItems = [
    { id: 'help', label: 'Aide', icon: HelpCircle },
    { id: 'about', label: 'À propos', icon: Info },
  ];

  return (
    <>
      <button
        className="btn btn-icon"
        onClick={() => setMenuOpen(!isMenuOpen)}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 1001,
          background: isMenuOpen ? 'var(--accent-primary)' : 'var(--bg-card)',
          color: isMenuOpen ? 'var(--bg-primary)' : 'var(--text-primary)',
        }}
      >
        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                zIndex: 999,
              }}
            />
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '280px',
                height: '100%',
                zIndex: 1000,
                padding: '80px 16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  padding: '0 12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  marginBottom: 8,
                }}
              >
                <h2 style={{
                  fontSize: 22,
                  fontWeight: 700,
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  GluciMiam
                </h2>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Compteur de glucides intelligent
                </p>
              </div>

              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate(item.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  <item.icon size={18} style={{ opacity: 0.8 }} />
                  {item.label}
                </button>
              ))}

              <div style={{ flex: 1 }} />

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 8, paddingTop: 8 }}>
                {bottomItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate(item.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <item.icon size={18} style={{ opacity: 0.8 }} />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
