import { useAppStore } from '../../stores/appStore';

export default function Header() {
  const { currentUser, activeSession, getTotalCarbs } = useAppStore();

  if (!activeSession) return null;

  const total = getTotalCarbs();

  return (
    <header
      className="glass"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '12px 60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div style={{
        fontSize: 32,
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1,
      }}>
        {total.toFixed(1)}g
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Glucides totaux
      </div>
      {currentUser && (
        <div style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 11,
          color: 'var(--accent-primary)',
          fontWeight: 600,
        }}>
          {currentUser.name}
        </div>
      )}
    </header>
  );
}
