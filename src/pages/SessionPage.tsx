import { useState, useCallback, useRef } from 'react';
import { Plus, StopCircle, Loader, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores/appStore';
import Header from '../components/layout/Header';
import PhotoViewer from '../components/session/PhotoViewer';
import FoodItemCard from '../components/session/FoodItemCard';
import CameraCapture from '../components/camera/CameraCapture';
import { analyzeFoodMulti, findCachedAnalysis } from '../services/llm';
import { searchFoodMultiKeyword } from '../services/food';
import type { ImageCacheEntry, LLMFoodEntry, AnalysisProgress } from '../types';

interface SessionPageProps {
  onNavigate: (page: string) => void;
}

export default function SessionPage({ onNavigate }: SessionPageProps) {
  const { activeSession, currentUser, endSession, addFoodItem, sessionFoodItems } = useAppStore();
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<{ entry: ImageCacheEntry; photos: string[]; userContext?: string } | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const preloadedDbHintsRef = useRef<string | null>(null);

  const addResults = useCallback(async (results: LLMFoodEntry[], photoBase64: string, userContext?: string, fromCache = false) => {
    if (!activeSession?.id) return;
    for (const result of results) {
      await addFoodItem({
        sessionId: activeSession.id,
        photoBase64,
        photoTimestamp: new Date(),
        userContext,
        detectedFoodName: result.foodName,
        estimatedWeightG: result.estimatedWeightG,
        estimatedCarbsG: result.totalCarbsG,
        carbsPer100g: result.carbsPer100g,
        llmResponse: (result.reasoning || '') + (fromCache ? ' [depuis cache]' : ''),
        confidence: result.confidence,
      });
    }
  }, [activeSession, addFoodItem]);

  const handleContextChange = useCallback(async (context: string) => {
    if (!context.trim()) { preloadedDbHintsRef.current = null; return; }
    try {
      const matches = await searchFoodMultiKeyword(context);
      if (matches.length > 0) {
        preloadedDbHintsRef.current = matches.map((m) => `- ${m.name}: ${m.carbsPer100g}g/100g`).join('\n');
      } else {
        preloadedDbHintsRef.current = null;
      }
    } catch { preloadedDbHintsRef.current = null; }
  }, []);

  const handleAddPhoto = useCallback(async (photos: string[], userContext?: string) => {
    if (!activeSession?.id || !currentUser) return;
    setShowCamera(false);
    setLlmError(null);

    // Check cache first
    const cached = await findCachedAnalysis(photos[0], currentUser.id!);
    if (cached) {
      setCacheHit({ entry: cached.entry, photos, userContext });
      return;
    }

    await runAnalysis(photos, userContext);
  }, [activeSession, currentUser, addFoodItem]);

  const runAnalysis = async (photos: string[], userContext?: string) => {
    if (!activeSession?.id || !currentUser) return;
    setAnalyzing(true);
    setLlmError(null);
    setProgress(null);

    const photoBase64 = photos[0];
    try {
      const results = await analyzeFoodMulti(photos, currentUser.fingerLengthMm, userContext, currentUser.id, (p) => setProgress(p));
      await addResults(results, photoBase64, userContext);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setLlmError(errorMsg);
      await addFoodItem({
        sessionId: activeSession.id,
        photoBase64,
        photoTimestamp: new Date(),
        userContext,
        detectedFoodName: 'Analyse échouée',
        estimatedWeightG: 0,
        estimatedCarbsG: 0,
        llmResponse: errorMsg,
        confidence: 0,
      });
    }

    setAnalyzing(false);
    setProgress(null);
  };

  const handleUseCachedResults = async () => {
    if (!cacheHit) return;
    setAnalyzing(true);
    await addResults(cacheHit.entry.foodResults, cacheHit.photos[0], cacheHit.userContext, true);
    setCacheHit(null);
    setAnalyzing(false);
  };

  const handleSkipCache = async () => {
    if (!cacheHit) return;
    const { photos, userContext } = cacheHit;
    setCacheHit(null);
    await runAnalysis(photos, userContext);
  };

  const handleEndSession = async () => {
    await endSession();
    onNavigate('home');
  };

  if (!activeSession) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />

      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <AnimatePresence mode="wait">
          {showCamera ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CameraCapture
                onCapture={handleAddPhoto}
                onCancel={() => setShowCamera(false)}
                onContextChange={handleContextChange}
              />
            </motion.div>
          ) : (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Cache prompt */}
              {cacheHit && (
                <div className="glass" style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  border: '1px solid var(--accent-primary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="var(--accent-primary)" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Plat similaire reconnu
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Similaire au {cacheHit.entry.sessionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {cacheHit.entry.foodResults.map((food, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      padding: '2px 4px',
                    }}>
                      <span>{food.foodName}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {food.totalCarbsG.toFixed(1)}g
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className="btn btn-primary" onClick={handleUseCachedResults} style={{ flex: 1, fontSize: 12, gap: 6 }}>
                      <Clock size={14} /> Réutiliser
                    </button>
                    <button className="btn btn-secondary" onClick={handleSkipCache} style={{ flex: 1, fontSize: 12, gap: 6 }}>
                      <RefreshCw size={14} /> Nouvelle analyse
                    </button>
                  </div>
                </div>
              )}

              {/* Photo Viewer */}
              {sessionFoodItems.length > 0 ? (
                <>
                  <PhotoViewer />
                  <FoodItemCard onError={(msg) => setLlmError(msg)} />
                </>
              ) : !cacheHit ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                  }}
                >
                  {analyzing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      >
                        <Loader size={32} color="var(--accent-primary)" />
                      </motion.div>
                      <p>{progress?.message || 'Analyse du plat en cours...'}</p>
                      {progress?.foodNames && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                          {progress.foodNames.map((name) => (
                            <span key={name} style={{
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--accent-primary)',
                              fontSize: 12,
                              color: 'var(--accent-primary)',
                              fontWeight: 600,
                            }}>
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {progress?.partialFoods && progress.partialFoods.length > 0 && (
                        <div className="glass" style={{ width: '100%', padding: 12, borderRadius: 'var(--radius-md)', marginTop: 8 }}>
                          {progress.partialFoods.map((food, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', padding: '4px 0',
                              fontSize: 13, color: 'var(--text-secondary)',
                              borderBottom: i < progress.partialFoods!.length - 1 ? '1px solid var(--border-color)' : 'none',
                            }}>
                              <span>{food.foodName}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {food.totalCarbsG.toFixed(1)}g
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p>Aucune photo pour l'instant</p>
                      <p style={{ fontSize: 12, marginTop: 8 }}>
                        Appuyez sur + pour photographier un plat
                      </p>
                    </>
                  )}
                </div>
              ) : null}

              {/* Food items list summary */}
              {sessionFoodItems.length > 1 && (
                <div
                  className="glass"
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Détail du repas
                  </div>
                  {sessionFoodItems.map((item, i) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: i < sessionFoodItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{item.detectedFoodName}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {(item.correctedCarbsG ?? item.estimatedCarbsG).toFixed(1)}g
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {analyzing && !showCamera && sessionFoodItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              >
                <Loader size={16} color="var(--accent-primary)" />
              </motion.div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {progress?.message || 'Analyse en cours...'}
              </span>
            </div>
            {progress?.foodNames && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                {progress.foodNames.map((name) => (
                  <span key={name} style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--accent-primary)',
                    fontSize: 11,
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {llmError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid var(--danger)',
              fontSize: 12,
              color: 'var(--danger)',
              wordBreak: 'break-word',
            }}
          >
            <strong>Erreur LLM :</strong> {llmError}
            <button
              onClick={() => setLlmError(null)}
              style={{ float: 'right', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              x
            </button>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div
        className="glass"
        style={{
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        {confirmEnd ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
              Terminer la session ?
            </span>
            <button className="btn btn-secondary" onClick={() => setConfirmEnd(false)} style={{ padding: '8px 16px', fontSize: 13 }}>
              Non
            </button>
            <button className="btn btn-danger" onClick={handleEndSession} style={{ padding: '8px 16px', fontSize: 13 }}>
              Oui, terminer
            </button>
          </div>
        ) : (
          <>
            {!showCamera && (
              <motion.button
                className="btn btn-primary"
                onClick={() => setShowCamera(true)}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <Plus size={24} />
              </motion.button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmEnd(true)}
              style={{ flex: 1, gap: 8 }}
            >
              <StopCircle size={16} />
              Fin de session repas
            </button>
          </>
        )}
      </div>
    </div>
  );
}
