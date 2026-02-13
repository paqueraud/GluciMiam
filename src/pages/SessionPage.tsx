import { useState, useCallback } from 'react';
import { Plus, StopCircle, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores/appStore';
import Header from '../components/layout/Header';
import PhotoViewer from '../components/session/PhotoViewer';
import FoodItemCard from '../components/session/FoodItemCard';
import CameraCapture from '../components/camera/CameraCapture';
import { analyzeFood } from '../services/llm';

interface SessionPageProps {
  onNavigate: (page: string) => void;
}

export default function SessionPage({ onNavigate }: SessionPageProps) {
  const { activeSession, currentUser, endSession, addFoodItem, sessionFoodItems } = useAppStore();
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const handleAddPhoto = useCallback(async (photoBase64: string) => {
    if (!activeSession?.id || !currentUser) return;
    setShowCamera(false);
    setAnalyzing(true);

    try {
      const result = await analyzeFood(photoBase64, currentUser.fingerLengthMm);
      await addFoodItem({
        sessionId: activeSession.id,
        photoBase64,
        photoTimestamp: new Date(),
        detectedFoodName: result.foodName,
        estimatedWeightG: result.estimatedWeightG,
        estimatedCarbsG: result.totalCarbsG,
        llmResponse: result.reasoning,
        confidence: result.confidence,
      });
    } catch (err) {
      await addFoodItem({
        sessionId: activeSession.id,
        photoBase64,
        photoTimestamp: new Date(),
        detectedFoodName: err instanceof Error ? 'Analyse échouée' : 'Erreur',
        estimatedWeightG: 0,
        estimatedCarbsG: 0,
        llmResponse: err instanceof Error ? err.message : 'Erreur',
        confidence: 0,
      });
    }

    setAnalyzing(false);
  }, [activeSession, currentUser, addFoodItem]);

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
              />
            </motion.div>
          ) : (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Photo Viewer */}
              {sessionFoodItems.length > 0 ? (
                <>
                  <PhotoViewer />
                  <FoodItemCard />
                </>
              ) : (
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
                      <p>Analyse du plat en cours...</p>
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
              )}

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Loader size={16} color="var(--accent-primary)" />
            </motion.div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyse en cours...</span>
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
