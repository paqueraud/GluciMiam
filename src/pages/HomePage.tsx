import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores/appStore';
import CameraCapture from '../components/camera/CameraCapture';
import UserSelector from '../components/user/UserSelector';
import { analyzeFood } from '../services/llm';
import { initHandDetection, detectHand, identifyUserByHand } from '../services/mediapipe';
import { db } from '../db';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

type Step = 'idle' | 'camera' | 'select-user' | 'analyzing';

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
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingContext, setPendingContext] = useState<string | undefined>(undefined);
  const isCreatingSession = useRef(false);

  useEffect(() => {
    // Only redirect on initial load if there's an existing active session
    loadActiveSession().then(() => {
      const session = useAppStore.getState().activeSession;
      if (session && !isCreatingSession.current) {
        onNavigate('session');
      }
    });
    loadUsers();
    loadActiveLLMConfig();
    initHandDetection().catch(() => {
      // MediaPipe may fail to load on some devices, that's ok
    });
  }, [loadActiveSession, loadUsers, loadActiveLLMConfig, onNavigate]);

  const handleNewSession = () => {
    setStep('camera');
    setError(null);
  };

  const handlePhotoCapture = useCallback(async (photoBase64: string, userContext?: string) => {
    setPendingPhoto(photoBase64);
    setPendingContext(userContext);
    setStep('analyzing');
    setAnalyzing(true);

    try {
      // Try hand detection to identify user
      const img = new Image();
      img.src = photoBase64;
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const handResult = detectHand(canvas);

      if (handResult.detected && handResult.indexFingerLength) {
        const user = await identifyUserByHand(handResult.indexFingerLength, img.naturalWidth);
        if (user) {
          setCurrentUser(user);
          isCreatingSession.current = true;
          const session = await startSession(user.id!);
          await processAndAddFoodItem(photoBase64, user.fingerLengthMm, session.id!, userContext);
          isCreatingSession.current = false;
          onNavigate('session');
          return;
        }
      }

      setAnalyzing(false);
      setStep('select-user');
    } catch {
      isCreatingSession.current = false;
      setAnalyzing(false);
      setStep('select-user');
    }
  }, [setCurrentUser, startSession, onNavigate]);

  const processAndAddFoodItem = async (photoBase64: string, fingerLengthMm: number, sessionId: number, userContext?: string) => {
    try {
      const result = await analyzeFood(photoBase64, fingerLengthMm, userContext);
      const { addFoodItem } = useAppStore.getState();
      await addFoodItem({
        sessionId,
        photoBase64,
        photoTimestamp: new Date(),
        userContext,
        detectedFoodName: result.foodName,
        estimatedWeightG: result.estimatedWeightG,
        estimatedCarbsG: result.totalCarbsG,
        llmResponse: result.reasoning,
        confidence: result.confidence,
      });
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

  const handleUserSelect = async (userId: number) => {
    const user = await db.users.get(userId);
    if (user) {
      setCurrentUser(user);
      isCreatingSession.current = true;
      setStep('analyzing');
      setAnalyzing(true);
      const session = await startSession(userId);
      if (pendingPhoto) {
        await processAndAddFoodItem(pendingPhoto, user.fingerLengthMm, session.id!, pendingContext);
      }
      isCreatingSession.current = false;
      onNavigate('session');
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
          GluciMiam
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
              Prenez votre plat en photo avec votre index visible pour commencer
            </p>
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
            />
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
            <p style={{ color: 'var(--warning)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              Main non reconnue automatiquement
            </p>
            <UserSelector onSelect={handleUserSelect} onCreateNew={handleCreateUser} />
          </motion.div>
        )}

        {step === 'analyzing' && analyzing && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Loader size={40} color="var(--accent-primary)" />
            </motion.div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analyse en cours...</p>
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
