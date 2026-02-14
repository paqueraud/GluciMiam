import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Loader, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores/appStore';
import CameraCapture from '../components/camera/CameraCapture';
import UserSelector from '../components/user/UserSelector';
import { analyzeFoodMulti, findCachedAnalysis } from '../services/llm';
import { searchFoodMultiKeyword } from '../services/food';
import { db } from '../db';
import type { ImageCacheEntry, LLMFoodEntry, AnalysisProgress } from '../types';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

type Step = 'idle' | 'select-user' | 'camera' | 'analyzing' | 'cache-prompt';

export default function HomePage({ onNavigate }: HomePageProps) {
  const {
    loadActiveSession,
    loadUsers,
    setCurrentUser,
    startSession,
    loadActiveLLMConfig,
  } = useAppStore();

  const [step, setStep] = useState<Step>('idle');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<{ entry: ImageCacheEntry; photos: string[]; userContext?: string } | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const preloadedDbHintsRef = useRef<string | null>(null);
  const isCreatingSession = useRef(false);

  useEffect(() => {
    loadActiveSession().then(() => {
      const session = useAppStore.getState().activeSession;
      if (session && !isCreatingSession.current) {
        onNavigate('session');
      }
    });
    loadUsers();
    loadActiveLLMConfig();
  }, [loadActiveSession, loadUsers, loadActiveLLMConfig, onNavigate]);

  const handleNewSession = async () => {
    setError(null);
    await loadUsers();
    const currentUsers = useAppStore.getState().users;

    if (currentUsers.length === 0) {
      onNavigate('new-user');
      return;
    }

    if (currentUsers.length === 1) {
      setCurrentUser(currentUsers[0]);
      setStep('camera');
    } else {
      setStep('select-user');
    }
  };

  const handleUserSelect = async (userId: number) => {
    const user = await db.users.get(userId);
    if (user) {
      setCurrentUser(user);
      setStep('camera');
    }
  };

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

  const handlePhotoCapture = useCallback(async (photos: string[], userContext?: string) => {
    const user = useAppStore.getState().currentUser;
    if (!user) return;

    // Check image cache before LLM call
    const cached = await findCachedAnalysis(photos[0], user.id!);
    if (cached) {
      setCacheHit({ entry: cached.entry, photos, userContext });
      setStep('cache-prompt');
      return;
    }

    await runAnalysis(photos, userContext);
  }, [startSession, onNavigate]);

  const runAnalysis = async (photos: string[], userContext?: string) => {
    const user = useAppStore.getState().currentUser;
    if (!user) return;

    setStep('analyzing');
    setAnalyzing(true);
    isCreatingSession.current = true;

    const session = await startSession(user.id!);
    await processAndAddFoodItems(photos, user.fingerLengthMm, user.id!, session.id!, userContext);

    isCreatingSession.current = false;
    onNavigate('session');
  };

  const handleUseCachedResults = async () => {
    if (!cacheHit) return;
    const user = useAppStore.getState().currentUser;
    if (!user) return;

    setStep('analyzing');
    setAnalyzing(true);
    isCreatingSession.current = true;

    const session = await startSession(user.id!);
    await addCachedFoodItems(cacheHit.entry.foodResults, cacheHit.photos[0], session.id!, cacheHit.userContext);

    setCacheHit(null);
    isCreatingSession.current = false;
    onNavigate('session');
  };

  const handleSkipCache = async () => {
    if (!cacheHit) return;
    const { photos, userContext } = cacheHit;
    setCacheHit(null);
    await runAnalysis(photos, userContext);
  };

  const addCachedFoodItems = async (results: LLMFoodEntry[], photoBase64: string, sessionId: number, userContext?: string) => {
    const { addFoodItem } = useAppStore.getState();
    for (const result of results) {
      await addFoodItem({
        sessionId,
        photoBase64,
        photoTimestamp: new Date(),
        userContext,
        detectedFoodName: result.foodName,
        estimatedWeightG: result.estimatedWeightG,
        estimatedCarbsG: result.totalCarbsG,
        carbsPer100g: result.carbsPer100g,
        llmResponse: (result.reasoning || '') + ' [depuis cache]',
        confidence: result.confidence,
      });
    }
  };

  const processAndAddFoodItems = async (photos: string[], fingerLengthMm: number, userId: number, sessionId: number, userContext?: string) => {
    const photoBase64 = photos[0];
    try {
      const results = await analyzeFoodMulti(photos, fingerLengthMm, userContext, userId, (p) => setProgress(p));
      const { addFoodItem } = useAppStore.getState();
      for (const result of results) {
        await addFoodItem({
          sessionId,
          photoBase64,
          photoTimestamp: new Date(),
          userContext,
          detectedFoodName: result.foodName,
          estimatedWeightG: result.estimatedWeightG,
          estimatedCarbsG: result.totalCarbsG,
          carbsPer100g: result.carbsPer100g,
          llmResponse: result.reasoning,
          confidence: result.confidence,
        });
      }
    } catch (err) {
      const { addFoodItem } = useAppStore.getState();
      await addFoodItem({
        sessionId,
        photoBase64,
        photoTimestamp: new Date(),
        userContext,
        detectedFoodName: 'Analyse échouée - corrigez manuellement',
        estimatedWeightG: 0,
        estimatedCarbsG: 0,
        llmResponse: err instanceof Error ? err.message : 'Erreur inconnue',
        confidence: 0,
      });
      setError(err instanceof Error ? err.message : "Erreur d'analyse LLM");
    }
  };

  const handleCreateUser = () => {
    onNavigate('new-user');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 40, textAlign: 'center' }}
      >
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
          }}
        >
          GlucIA
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
          Compteur de glucides intelligent
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.button
              className="btn btn-primary"
              onClick={handleNewSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                fontSize: 16,
                fontWeight: 700,
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 0 60px rgba(0,212,255,0.3), 0 0 120px rgba(124,58,237,0.15)',
              }}
            >
              <Plus size={36} />
              Nouvelle session
            </motion.button>

            <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', maxWidth: 250, marginTop: 8 }}>
              Prenez votre plat en photo pour compter les glucides
            </p>
          </motion.div>
        )}

        {step === 'select-user' && (
          <motion.div
            key="select-user"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <UserSelector onSelect={handleUserSelect} onCreateNew={handleCreateUser} />
          </motion.div>
        )}

        {step === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <CameraCapture
              onCapture={handlePhotoCapture}
              onCancel={() => setStep('idle')}
              onContextChange={handleContextChange}
            />
          </motion.div>
        )}

        {step === 'cache-prompt' && cacheHit && (
          <motion.div
            key="cache-prompt"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              width: '100%',
              maxWidth: 360,
            }}
          >
            <div className="glass" style={{
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              textAlign: 'center',
            }}>
              <Clock size={32} color="var(--accent-primary)" style={{ margin: '0 auto' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Plat similaire reconnu
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Similaire au {cacheHit.entry.sessionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
                {cacheHit.entry.foodResults.map((food, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}>
                    <span>{food.foodName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {food.totalCarbsG.toFixed(1)}g
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleUseCachedResults} style={{ flex: 1, fontSize: 13, gap: 6 }}>
                  <Clock size={14} /> Réutiliser
                </button>
                <button className="btn btn-secondary" onClick={handleSkipCache} style={{ flex: 1, fontSize: 13, gap: 6 }}>
                  <RefreshCw size={14} /> Nouvelle analyse
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'analyzing' && analyzing && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 360, width: '100%' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Loader size={40} color="var(--accent-primary)" />
            </motion.div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {progress?.message || 'Analyse en cours...'}
            </p>
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
              <div className="glass" style={{ width: '100%', padding: 12, borderRadius: 'var(--radius-md)' }}>
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
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          padding: '10px 20px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
