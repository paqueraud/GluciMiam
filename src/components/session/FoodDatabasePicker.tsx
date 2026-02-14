import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FoodDatabaseEntry } from '../../types';
import { getAllFoodsSorted } from '../../services/food';

interface FoodDatabasePickerProps {
  onSelect: (entry: FoodDatabaseEntry) => void;
  onClose: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function FoodDatabasePicker({ onSelect, onClose }: FoodDatabasePickerProps) {
  const [allFoods, setAllFoods] = useState<FoodDatabaseEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getAllFoodsSorted().then((foods) => {
      setAllFoods(foods);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allFoods;
    const lower = searchQuery.toLowerCase();
    return allFoods.filter((f) => f.name.toLowerCase().includes(lower));
  }, [allFoods, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, FoodDatabaseEntry[]> = {};
    for (const food of filtered) {
      const letter = food.name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(food);
    }
    return groups;
  }, [filtered]);

  const availableLetters = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const scrollToLetter = useCallback((letter: string) => {
    const el = letterRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          flex: 1,
        }}>
          Base de données alimentaire
        </h3>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>
          {filtered.length} aliments
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Search bar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          border: '1px solid var(--border-color)',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un aliment..."
            autoFocus
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              flex: 1,
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body: list + alphabet */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Scrollable list */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px 20px 16px',
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Aucun aliment trouvé
            </div>
          ) : (
            availableLetters.map((letter) => (
              <div key={letter}>
                <div
                  ref={(el) => { letterRefs.current[letter] = el; }}
                  style={{
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-primary)',
                    padding: '8px 0 4px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--accent-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    zIndex: 1,
                  }}
                >
                  {letter}
                </div>
                {grouped[letter].map((food) => (
                  <button
                    key={food.id ?? food.name}
                    onClick={() => onSelect(food)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '10px 8px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1, paddingRight: 12 }}>{food.name}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {food.carbsPer100g}g/100g
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Alphabet sidebar */}
        {!searchQuery && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 4px',
            flexShrink: 0,
            width: 24,
          }}>
            {ALPHABET.map((letter) => {
              const hasItems = availableLetters.includes(letter);
              return (
                <button
                  key={letter}
                  onClick={() => hasItems && scrollToLetter(letter)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '1px 0',
                    fontSize: 9,
                    fontWeight: 700,
                    color: hasItems ? 'var(--accent-primary)' : 'var(--text-muted)',
                    opacity: hasItems ? 1 : 0.3,
                    cursor: hasItems ? 'pointer' : 'default',
                    lineHeight: 1.4,
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
