import { useState, useEffect } from 'react';
import { Pencil, Check, X, Trash2, RefreshCw, Loader, Info, ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { analyzeFood } from '../../services/llm';
import { searchFoodMultiKeyword } from '../../services/food';
import FoodDatabasePicker from './FoodDatabasePicker';
import type { FoodDatabaseEntry } from '../../types';

interface FoodItemCardProps {
  onError?: (msg: string) => void;
}

export default function FoodItemCard({ onError }: FoodItemCardProps) {
  const { sessionFoodItems, currentPhotoIndex, updateFoodItem, deleteFoodItem, currentUser } = useAppStore();
  const [isEditingCarbs, setIsEditingCarbs] = useState(false);
  const [editCarbsValue, setEditCarbsValue] = useState('');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editWeightValue, setEditWeightValue] = useState('');
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [suggestions, setSuggestions] = useState<FoodDatabaseEntry[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  if (sessionFoodItems.length === 0) return null;

  const item = sessionFoodItems[currentPhotoIndex];
  if (!item) return null;

  const carbsToShow = item.correctedCarbsG ?? item.estimatedCarbsG;
  const isFailed = item.confidence === 0 && item.estimatedCarbsG === 0;
  const currentCarbsPer100g = item.carbsPer100g ?? 0;
  const lowConfidence = !isFailed && (item.confidence ?? 1) < 0.9;

  // Load suggestions when item changes and confidence is low
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setSuggestionsDismissed(false);
    setSuggestionsLoaded(false);
    setSuggestions([]);
    if (!item.detectedFoodName || isFailed) return;
    if ((item.confidence ?? 1) >= 0.9) return;
    searchFoodMultiKeyword(item.detectedFoodName).then((results) => {
      setSuggestions(results);
      setSuggestionsLoaded(true);
    });
  }, [item.id, item.detectedFoodName, item.confidence, isFailed]);

  const handleSuggestionSelect = (food: FoodDatabaseEntry) => {
    if (item.id) {
      const newCarbs = Math.round((item.estimatedWeightG * food.carbsPer100g / 100) * 10) / 10;
      updateFoodItem(item.id, {
        detectedFoodName: food.name,
        carbsPer100g: food.carbsPer100g,
        estimatedCarbsG: newCarbs,
        correctedCarbsG: undefined,
        confidence: 1.0,
      });
    }
    setSuggestionsDismissed(true);
  };

  const startEditCarbs = () => {
    setEditCarbsValue(String(carbsToShow));
    setIsEditingCarbs(true);
  };

  const confirmEditCarbs = () => {
    const val = parseFloat(editCarbsValue);
    if (!isNaN(val) && val >= 0 && item.id) {
      updateFoodItem(item.id, { correctedCarbsG: val });
    }
    setIsEditingCarbs(false);
  };

  const startEditWeight = () => {
    setEditWeightValue(String(item.estimatedWeightG));
    setIsEditingWeight(true);
  };

  const confirmEditWeight = () => {
    const val = parseFloat(editWeightValue);
    if (!isNaN(val) && val >= 0 && item.id) {
      const updates: Record<string, number | undefined> = { estimatedWeightG: val };
      // Recalculate carbs if we know carbsPer100g
      if (currentCarbsPer100g > 0) {
        const newCarbs = Math.round((val * currentCarbsPer100g / 100) * 10) / 10;
        updates.estimatedCarbsG = newCarbs;
        updates.correctedCarbsG = undefined;
      }
      updateFoodItem(item.id, updates);
    }
    setIsEditingWeight(false);
  };

  const handleFoodSelect = (food: FoodDatabaseEntry) => {
    if (item.id) {
      const newCarbs = Math.round((item.estimatedWeightG * food.carbsPer100g / 100) * 10) / 10;
      updateFoodItem(item.id, {
        detectedFoodName: food.name,
        carbsPer100g: food.carbsPer100g,
        estimatedCarbsG: newCarbs,
        correctedCarbsG: undefined,
      });
    }
    setShowFoodPicker(false);
  };

  const handleDelete = () => {
    if (item.id) {
      deleteFoodItem(item.id);
      setConfirmDelete(false);
    }
  };

  const handleRetry = async () => {
    if (!item.id || !currentUser) return;
    setRetrying(true);
    try {
      const result = await analyzeFood(item.photoBase64, currentUser.fingerLengthMm, item.userContext);
      await updateFoodItem(item.id, {
        detectedFoodName: result.foodName,
        estimatedWeightG: result.estimatedWeightG,
        estimatedCarbsG: result.totalCarbsG,
        carbsPer100g: result.carbsPer100g,
        llmResponse: result.reasoning,
        confidence: result.confidence,
      });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Erreur inconnue');
    }
    setRetrying(false);
  };

  return (
    <>
      <div
        className="glass"
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'relative',
        }}
      >
        {/* Delete button */}
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <Trash2 size={15} />
        </button>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 14, 26, 0.95)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 10,
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center' }}>
              Supprimer cette entrée ?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', fontSize: 13 }}>
                Annuler
              </button>
              <button className="btn btn-danger" onClick={handleDelete} style={{ padding: '8px 16px', fontSize: 13 }}>
                Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Food name - clickable to search in DB */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingRight: 24,
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: isFailed ? 'var(--danger)' : 'var(--accent-primary)',
            textAlign: 'center',
          }}>
            {item.detectedFoodName || 'Analyse en cours...'}
          </div>
          <button
            onClick={() => setShowFoodPicker(true)}
            title="Choisir depuis la BDD"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <Search size={12} />
          </button>
        </div>

        {/* User context if any */}
        {item.userContext && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Contexte : {item.userContext}
          </div>
        )}

        {/* Low confidence suggestions */}
        {lowConfidence && suggestionsLoaded && !suggestionsDismissed && (
          <div style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
              <AlertTriangle size={13} />
              Confiance {Math.round((item.confidence ?? 0) * 100)}% — vérifiez l'aliment
              <button
                onClick={() => setSuggestionsDismissed(true)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 2 }}
              >
                <X size={13} />
              </button>
            </div>
            {suggestions.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {suggestions.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => handleSuggestionSelect(food)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {food.name}
                    <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {food.carbsPer100g}g
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Aucune correspondance dans la BDD
              </div>
            )}
            <button
              onClick={() => setShowFoodPicker(true)}
              className="btn btn-secondary"
              style={{ alignSelf: 'center', padding: '4px 12px', fontSize: 11, gap: 4, marginTop: 2 }}
            >
              <Search size={12} /> Voir toute la BDD
            </button>
          </div>
        )}

        {/* Retry button for failed analyses */}
        {isFailed && (
          <button
            className="btn btn-primary"
            onClick={handleRetry}
            disabled={retrying}
            style={{ margin: '4px auto', padding: '8px 20px', fontSize: 13, gap: 8 }}
          >
            {retrying ? (
              <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyse en cours...</>
            ) : (
              <><RefreshCw size={14} /> Relancer l'analyse</>
            )}
          </button>
        )}

        {/* Weight display/edit */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          {isEditingWeight ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                className="input"
                value={editWeightValue}
                onChange={(e) => setEditWeightValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmEditWeight()}
                style={{ width: 80, textAlign: 'center', padding: '4px 8px', fontSize: 13 }}
                autoFocus
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>g</span>
              <button className="btn btn-icon" onClick={confirmEditWeight} style={{ width: 28, height: 28, background: 'var(--success)', color: 'white' }}>
                <Check size={12} />
              </button>
              <button className="btn btn-icon" onClick={() => setIsEditingWeight(false)} style={{ width: 28, height: 28, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Poids :</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {item.estimatedWeightG}g
              </span>
              {currentCarbsPer100g > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  ({currentCarbsPer100g}g gluc/100g)
                </span>
              )}
              <button
                onClick={startEditWeight}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Carbs display */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          {isEditingCarbs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                className="input"
                value={editCarbsValue}
                onChange={(e) => setEditCarbsValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmEditCarbs()}
                style={{ width: 80, textAlign: 'center', padding: '6px 8px' }}
                autoFocus
              />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>g</span>
              <button className="btn btn-icon" onClick={confirmEditCarbs} style={{ width: 32, height: 32, background: 'var(--success)', color: 'white' }}>
                <Check size={14} />
              </button>
              <button className="btn btn-icon" onClick={() => setIsEditingCarbs(false)} style={{ width: 32, height: 32, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
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
              <button
                className="btn btn-icon"
                onClick={startEditCarbs}
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

        {/* LLM detail toggle */}
        {item.llmResponse && (
          <>
            <button
              onClick={() => setShowDetail(!showDetail)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '4px 0',
              }}
            >
              <Info size={13} />
              Détail LLM
              {showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showDetail && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {item.llmResponse}
              </div>
            )}
          </>
        )}
      </div>

      {/* Food Database Picker Modal */}
      <AnimatePresence>
        {showFoodPicker && (
          <FoodDatabasePicker
            onSelect={handleFoodSelect}
            onClose={() => setShowFoodPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
