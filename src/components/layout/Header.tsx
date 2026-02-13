import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { Pencil, Check } from 'lucide-react';

export default function Header() {
  const { currentUser, activeSession, getTotalCarbs, getCarbsRemaining, updateCarbsEnteredInPump } = useAppStore();
  const [editingPump, setEditingPump] = useState(false);
  const [pumpValue, setPumpValue] = useState('');

  if (!activeSession) return null;

  const total = getTotalCarbs();
  const entered = activeSession.carbsEnteredInPump ?? 0;
  const remaining = getCarbsRemaining();

  const startEditPump = () => {
    setPumpValue(String(entered));
    setEditingPump(true);
  };

  const confirmPump = () => {
    const val = parseFloat(pumpValue);
    if (!isNaN(val) && val >= 0) {
      updateCarbsEnteredInPump(val);
    }
    setEditingPump(false);
  };

  return (
    <header
      className="glass"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '10px 60px 10px 16px',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* User name */}
      {currentUser && (
        <div style={{
          position: 'absolute',
          right: 12,
          top: 8,
          fontSize: 11,
          color: 'var(--accent-primary)',
          fontWeight: 600,
        }}>
          {currentUser.name}
        </div>
      )}

      {/* 3 carb counters */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Total */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}>
            {total.toFixed(1)}g
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
            Total glucides
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 36, background: 'var(--border-color)' }} />

        {/* Entered in pump */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {editingPump ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  className="input"
                  value={pumpValue}
                  onChange={(e) => setPumpValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmPump()}
                  style={{ width: 60, padding: '2px 4px', fontSize: 16, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
                  autoFocus
                />
                <button
                  onClick={confirmPump}
                  style={{ background: 'var(--success)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <>
                <span style={{
                  fontSize: 26,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--success)',
                  lineHeight: 1,
                }}>
                  {entered.toFixed(1)}g
                </span>
                <button
                  onClick={startEditPump}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
            Dans pompe
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 36, background: 'var(--border-color)' }} />

        {/* Remaining */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: remaining > 0 ? 'var(--warning)' : 'var(--success)',
            lineHeight: 1,
          }}>
            {remaining.toFixed(1)}g
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
            Restant
          </div>
        </div>
      </div>
    </header>
  );
}
