import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, ImagePlus, Video, StopCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { openCamera, capturePhoto, stopCamera, fileToBase64 } from '../../services/camera';

interface CameraCaptureProps {
  onCapture: (photoBase64: string, context?: string) => void;
  onCancel?: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState('');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) stopCamera(streamRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      if (videoRef.current) {
        const stream = await openCamera(videoRef.current);
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current) {
      const photo = capturePhoto(videoRef.current);
      setPreview(photo);
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
      setIsStreaming(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      // Extract the best frame from the middle of the video
      if (videoRef.current && streamRef.current) {
        // Take a photo at the end of recording as the "best" frame
        const photo = capturePhoto(videoRef.current);
        setPreview(photo);
        stopCamera(streamRef.current);
        streamRef.current = null;
        setIsStreaming(false);
      }
    };

    recorder.start(100);
    recorderRef.current = recorder;
    setRecording(true);
    setRecordTimer(0);

    // Timer countdown
    timerRef.current = setInterval(() => {
      setRecordTimer((prev) => {
        if (prev >= 4.9) {
          // Auto-stop at 5 seconds
          stopRecording();
          return 5;
        }
        return prev + 0.1;
      });
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    recorderRef.current = null;
  }, []);

  const handleRetake = useCallback(() => {
    setPreview(null);
    setRecordTimer(0);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (preview) {
      onCapture(preview, userContext.trim() || undefined);
    }
  }, [preview, userContext, onCapture]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        // Extract frame from video file
        const url = URL.createObjectURL(file);
        const vid = document.createElement('video');
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        await new Promise<void>((resolve) => {
          vid.onloadeddata = () => {
            vid.currentTime = Math.min(vid.duration / 2, 2.5);
          };
          vid.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(vid, 0, 0);
            setPreview(canvas.toDataURL('image/jpeg', 0.85));
            URL.revokeObjectURL(url);
            resolve();
          };
        });
      } else {
        const base64 = await fileToBase64(file);
        setPreview(base64);
      }
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        width: '100%',
      }}
    >
      {/* Mode toggle */}
      {!isStreaming && !preview && (
        <div style={{
          display: 'flex',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}>
          <button
            onClick={() => setMode('photo')}
            style={{
              padding: '8px 20px',
              background: mode === 'photo' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: mode === 'photo' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Camera size={14} /> Photo
          </button>
          <button
            onClick={() => setMode('video')}
            style={{
              padding: '8px 20px',
              background: mode === 'video' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: mode === 'video' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Video size={14} /> Vidéo 5s
          </button>
        </div>
      )}

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          aspectRatio: '4/3',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: `2px solid ${recording ? 'var(--danger)' : 'var(--border-color)'}`,
          position: 'relative',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isStreaming ? 'block' : 'none',
            }}
          />
        )}

        {!isStreaming && !preview && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            {mode === 'photo' ? <Camera size={48} style={{ color: 'var(--text-muted)' }} /> : <Video size={48} style={{ color: 'var(--text-muted)' }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
              {mode === 'photo'
                ? 'Prenez une photo de votre plat avec votre index visible'
                : 'Filmez votre plat sous différents angles (5s max)'}
            </p>
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>
            )}
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <>
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(239,68,68,0.9)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: 'white',
                animation: 'pulse-glow 1s infinite',
              }} />
              REC {recordTimer.toFixed(1)}s / 5s
            </div>
            {/* Progress bar */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 4,
              width: `${(recordTimer / 5) * 100}%`,
              background: 'var(--danger)',
              transition: 'width 100ms linear',
            }} />
          </>
        )}

        {isStreaming && !recording && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              border: '2px solid var(--accent-primary)',
              borderRadius: 'var(--radius-lg)',
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Context input - shown when photo is taken */}
      {preview && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <label className="label">Contexte (optionnel)</label>
          <input
            className="input"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            placeholder="Ex: pâtes carbonara, environ 200g, sauce à part..."
            style={{ fontSize: 13 }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Aidez l'IA à mieux identifier le plat
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {!isStreaming && !preview && (
          <>
            <button className="btn btn-primary" onClick={startCamera}>
              {mode === 'photo' ? <Camera size={18} /> : <Video size={18} />}
              {mode === 'photo' ? 'Ouvrir caméra' : 'Lancer vidéo'}
            </button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={18} /> Galerie
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={mode === 'photo' ? 'image/*' : 'image/*,video/*'}
              capture="environment"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </>
        )}

        {isStreaming && !recording && mode === 'photo' && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleCapture}
              style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 0 }}
            >
              <Camera size={28} />
            </button>
            {onCancel && (
              <button className="btn btn-secondary" onClick={() => {
                if (streamRef.current) stopCamera(streamRef.current);
                setIsStreaming(false);
                onCancel();
              }}>
                Annuler
              </button>
            )}
          </>
        )}

        {isStreaming && !recording && mode === 'video' && (
          <>
            <button
              className="btn btn-danger"
              onClick={startRecording}
              style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 0 }}
            >
              <Video size={28} />
            </button>
            {onCancel && (
              <button className="btn btn-secondary" onClick={() => {
                if (streamRef.current) stopCamera(streamRef.current);
                setIsStreaming(false);
                onCancel();
              }}>
                Annuler
              </button>
            )}
          </>
        )}

        {recording && (
          <button
            className="btn btn-danger"
            onClick={stopRecording}
            style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 0, animation: 'pulse-glow 1s infinite' }}
          >
            <StopCircle size={28} />
          </button>
        )}

        {preview && (
          <>
            <button className="btn btn-secondary" onClick={handleRetake}>
              <RotateCcw size={18} /> Reprendre
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              <Check size={18} /> Valider
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
