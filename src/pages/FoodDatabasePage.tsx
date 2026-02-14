import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FoodDatabaseEntry } from '../types';
import { getAllFoodsSorted, addFoodEntry, updateFoodEntry, deleteFoodEntry } from '../services/food';

interface FoodDatabasePageProps {
  onClose: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function FoodDatabasePage({ onClose }: FoodDatabasePageProps) {
  const [allFoods, setAllFoods] = useState<FoodDatabaseEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCarbs, setAddCarbs] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const reload = useCallback(async () => {
    const foods = await getAllFoodsSorted();
    setAllFoods(foods);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

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
    letterRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleAdd = async () => {
    const name = addName.trim();
    const carbs = parseFloat(addCarbs);
    if (!name || isNaN(carbs) || carbs < 0) return;
    await addFoodEntry({ name, carbsPer100g: carbs, source: 'manual', category: addCategory.trim() || undefined });
    setAddName('');
    setAddCarbs('');
    setAddCategory('');
    setShowAddForm(false);
    await reload();
  };

  const startEdit = (food: FoodDatabaseEntry) => {
    setEditingId(food.id!);
    setEditName(food.name);
    setEditCarbs(String(food.carbsPer100g));
    setEditCategory(food.category || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    const carbs = parseFloat(editCarbs);
    if (!name || isNaN(carbs) || carbs < 0) return;
    await updateFoodEntry(editingId, { name, carbsPer100g: carbs, category: editCategory.trim() || undefined });
    setEditingId(null);
    await reload();
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId === id) {
      await deleteFoodEntry(id);
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
      await reload();
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
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
          Base alimentaire
        </h3>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {filtered.length} aliments
        </span>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: 12, gap: 4 }}
        >
          <Plus size={14} /> Ajouter
        </button>
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
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>Nouvel aliment</div>
          <input
            className="input"
            placeholder="Nom de l'aliment"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            autoFocus
            style={{ fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="number"
              placeholder="Glucides/100g"
              value={addCarbs}
              onChange={(e) => setAddCarbs(e.target.value)}
              style={{ fontSize: 13, flex: 1 }}
            />
            <input
              className="input"
              placeholder="Catégorie (optionnel)"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              style={{ fontSize: 13, flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ padding: '6px 14px', fontSize: 12 }}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '6px 14px', fontSize: 12 }}>
              <Check size={14} /> Ajouter
            </button>
          </div>
        </div>
      )}

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
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 20px 16px' }}>
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
                  <div key={food.id ?? food.name}>
                    {editingId === food.id ? (
                      /* Inline edit form */
                      <div style={{
                        padding: '8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        margin: '4px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}>
                        <input
                          className="input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ fontSize: 13, padding: '4px 8px' }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="input"
                            type="number"
                            value={editCarbs}
                            onChange={(e) => setEditCarbs(e.target.value)}
                            placeholder="g/100g"
                            style={{ fontSize: 13, padding: '4px 8px', flex: 1 }}
                          />
                          <input
                            className="input"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            placeholder="Catégorie"
                            style={{ fontSize: 13, padding: '4px 8px', flex: 1 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)} style={{ padding: '4px 10px', fontSize: 11 }}>
                            Annuler
                          </button>
                          <button className="btn btn-primary" onClick={handleSaveEdit} style={{ padding: '4px 10px', fontSize: 11 }}>
                            <Check size={12} /> Sauver
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display row */
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        gap: 8,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {food.name}
                          </div>
                          {food.category && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{food.category}</div>
                          )}
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}>
                          {food.carbsPer100g}g/100g
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, width: 28, textAlign: 'center' }}>
                          {food.source === 'local' ? 'BDD' : food.source === 'manual' ? 'MAN' : food.source === 'openfoodfacts' ? 'OFF' : food.source.toUpperCase()}
                        </span>
                        <button
                          onClick={() => startEdit(food)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(food.id!)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            color: confirmDeleteId === food.id ? 'var(--danger)' : 'var(--text-muted)',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
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
