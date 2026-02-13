import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export default function FoodItemCard() {
  const { sessionFoodItems, currentPhotoIndex, updateFoodItem } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  if (sessionFoodItems.length === 0) return null;

  const item = sessionFoodItems[currentPhotoIndex];
  if (!item) return null;

  const carbsToShow = item.correctedCarbsG ?? item.estimatedCarbsG;

  const startEdit = () => {
    setEditValue(String(carbsToShow));
    setIsEditing(true);
  };

  const confirmEdit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0 && item.id) {
      updateFoodItem(item.id, { correctedCarbsG: val });
    }
    setIsEditing(false);
  };

  return (
    <div
      className="glass"
      style={{
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Food name */}
      <div style={{
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--accent-primary)',
        textAlign: 'center',
      }}>
        {item.detectedFoodName || 'Analyse en cours...'}
      </div>

      {/* Carbs display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              className="input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
              style={{ width: 80, textAlign: 'center', padding: '6px 8px' }}
              autoFocus
            />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>g</span>
            <button
              className="btn btn-icon"
              onClick={confirmEdit}
              style={{
                width: 32,
                height: 32,
                background: 'var(--success)',
                color: 'white',
              }}
            >
              <Check size={14} />
            </button>
            <button
              className="btn btn-icon"
              onClick={() => setIsEditing(false)}
              style={{
                width: 32,
                height: 32,
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span style={{
              fontSize: 28,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}>
              {carbsToShow.toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              g glucides
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ({item.estimatedWeightG}g)
            </span>
            <button
              className="btn btn-icon"
              onClick={startEdit}
              style={{
                width: 32,
                height: 32,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--accent-primary)',
              }}
            >
              <Pencil size={13} />
            </button>
          </>
        )}
      </div>

      {item.correctedCarbsG !== undefined && item.correctedCarbsG !== item.estimatedCarbsG && (
        <div style={{
          fontSize: 11,
          color: 'var(--warning)',
          textAlign: 'center',
        }}>
          Estimation initiale : {item.estimatedCarbsG.toFixed(1)}g (corrigé)
        </div>
      )}
    </div>
  );
}
