import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, ImagePlus, Video, StopCircle, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { openCamera, capturePhoto, stopCamera, fileToBase64 } from '../../services/camera';

interface CameraCaptureProps {
  onCapture: (photos: string[], context?: string) => void;
  onCancel?: () => void;
  onContextChange?: (context: string) => void;
}

export default function CameraCapture({ onCapture, onCancel, onContextChange }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondAngleFileRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState('');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [capturingSecondAngle, setCapturingSecondAngle] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoFramesRef = useRef<string[]>([]);
  const contextDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview = we have at least 1 photo and we're NOT in the middle of capturing a 2nd angle
  const hasPreview = photos.length > 0 && !capturingSecondAngle;
  // Initial state = no photos, not streaming, not capturing 2nd angle
  const isInitial = photos.length === 0 && !isStreaming && !capturingSecondAngle;

  useEffect(() => {
    return () => {
      if (streamRef.current) stopCamera(streamRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current);
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
      // If second angle failed, go back to preview
      if (capturingSecondAngle) setCapturingSecondAngle(false);
    }
  }, [capturingSecondAngle]);

  const handleCapture = useCallback(() => {
    if (videoRef.current) {
      const photo = capturePhoto(videoRef.current);
      if (capturingSecondAngle) {
        setPhotos((prev) => [...prev, photo]);
        setCapturingSecondAngle(false);
      } else {
        setPhotos([photo]);
      }
      if (streamRef.current) { stopCamera(streamRef.current); streamRef.current = null; }
      setIsStreaming(false);
    }
  }, [capturingSecondAngle]);

  const handleAddSecondAngle = useCallback(() => {
    setCapturingSecondAngle(true);
    // Don't auto-start camera - let user choose camera or gallery
  }, []);

  const cancelSecondAngle = useCallback(() => {
    if (streamRef.current) { stopCamera(streamRef.current); streamRef.current = null; }
    setIsStreaming(false);
    setCapturingSecondAngle(false);
  }, []);

  const handleSecondAngleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const base64 = await fileToBase64(file);
      setPhotos((prev) => [...prev, base64]);
      setCapturingSecondAngle(false);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || !videoRef.current) return;

    chunksRef.current = [];
    videoFramesRef.current = [];

    // Capture first frame
    const firstFrame = capturePhoto(videoRef.current);
    videoFramesRef.current.push(firstFrame);

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (videoRef.current && streamRef.current) {
        const lastFrame = capturePhoto(videoRef.current);
        videoFramesRef.current.push(lastFrame);
        // Both frames are stored internally for multi-angle LLM analysis
        setPhotos([...videoFramesRef.current]);
        stopCamera(streamRef.current);
        streamRef.current = null;
        setIsStreaming(false);
      }
    };

    recorder.start(100);
    recorderRef.current = recorder;
    setRecording(true);
    setRecordTimer(0);

    timerRef.current = setInterval(() => {
      setRecordTimer((prev) => {
        if (prev >= 4.9) {
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
    setPhotos([]);
    setRecordTimer(0);
    setCapturingSecondAngle(false);
    videoFramesRef.current = [];
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (photos.length > 0) {
      onCapture(photos, userContext.trim() || undefined);
    }
  }, [photos, userContext, onCapture]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        // Extract 2 frames from video file
        const url = URL.createObjectURL(file);
        const vid = document.createElement('video');
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        const frames: string[] = [];

        await new Promise<void>((resolve) => {
          vid.onloadeddata = () => {
            vid.currentTime = Math.min(vid.duration * 0.25, 1);
          };
          vid.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(vid, 0, 0);
            frames.push(canvas.toDataURL('image/jpeg', 0.85));

            if (frames.length === 1) {
              vid.currentTime = Math.min(vid.duration * 0.75, vid.duration - 0.5);
            } else {
              URL.revokeObjectURL(url);
              setPhotos(frames);
              resolve();
            }
          };
        });
      } else {
        const base64 = await fileToBase64(file);
        setPhotos([base64]);
      }
    }
    e.target.value = '';
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
      {/* Mode toggle - only in initial state */}
      {isInitial && (
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
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
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
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Video size={14} /> Vidéo 5s
          </button>
        </div>
      )}

      {/* Camera / preview area */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          aspectRatio: '4/3',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: `2px solid ${recording ? 'var(--danger)' : capturingSecondAngle ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          position: 'relative',
        }}
      >
        {hasPreview ? (
          <img
            src={photos[photos.length - 1]}
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

        {/* Placeholder: initial state or 2nd angle waiting for camera */}
        {!isStreaming && !hasPreview && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            {capturingSecondAngle ? (
              <>
                <Camera size={48} style={{ color: 'var(--accent-primary)' }} />
                <p style={{ color: 'var(--accent-primary)', fontSize: 13, textAlign: 'center', padding: '0 20px', fontWeight: 600 }}>
                  Capturez le plat sous un autre angle
                </p>
              </>
            ) : (
              <>
                {mode === 'photo' ? <Camera size={48} style={{ color: 'var(--text-muted)' }} /> : <Video size={48} style={{ color: 'var(--text-muted)' }} />}
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
                  {mode === 'photo'
                    ? 'Prenez une photo de votre plat avec votre index visible'
                    : 'Filmez votre plat sous différents angles (5s max)'}
                </p>
              </>
            )}
            {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
          </div>
        )}

        {/* Second angle indicator when streaming */}
        {capturingSecondAngle && isStreaming && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,212,255,0.9)', padding: '4px 10px',
            borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700, color: 'white',
          }}>
            2ème angle
          </div>
        )}

        {/* Photo count badge */}
        {hasPreview && photos.length > 1 && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,212,255,0.9)', padding: '4px 10px',
            borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            {photos.length} angles
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <>
            <div style={{
              position: 'absolute', top: 12, left: 12,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(239,68,68,0.9)', padding: '4px 10px',
              borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700, color: 'white',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: 'white',
                animation: 'pulse-glow 1s infinite',
              }} />
              REC {recordTimer.toFixed(1)}s / 5s
            </div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: 4,
              width: `${(recordTimer / 5) * 100}%`, background: 'var(--danger)',
              transition: 'width 100ms linear',
            }} />
          </>
        )}

        {isStreaming && !recording && !capturingSecondAngle && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            border: '2px solid var(--accent-primary)', borderRadius: 'var(--radius-lg)', opacity: 0.5,
          }} />
        )}
      </div>

      {/* Context input */}
      {hasPreview && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <label className="label">Contexte (optionnel)</label>
          <input
            className="input"
            value={userContext}
            onChange={(e) => {
              const val = e.target.value;
              setUserContext(val);
              if (onContextChange) {
                if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current);
                contextDebounceRef.current = setTimeout(() => onContextChange(val), 300);
              }
            }}
            placeholder="Ex: pâtes carbonara, environ 200g, sauce à part..."
            style={{ fontSize: 13 }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Aidez l'IA à mieux identifier le plat
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* Initial state: open camera or gallery */}
        {isInitial && (
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

        {/* 2nd angle: not streaming yet → show camera + gallery buttons */}
        {capturingSecondAngle && !isStreaming && (
          <>
            <button className="btn btn-primary" onClick={startCamera}>
              <Camera size={18} /> Ouvrir caméra
            </button>
            <button className="btn btn-secondary" onClick={() => secondAngleFileRef.current?.click()}>
              <ImagePlus size={18} /> Galerie
            </button>
            <button className="btn btn-secondary" onClick={cancelSecondAngle}>
              Annuler
            </button>
            <input
              ref={secondAngleFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSecondAngleFile}
              style={{ display: 'none' }}
            />
          </>
        )}

        {/* Streaming in photo mode: capture button */}
        {isStreaming && !recording && mode === 'photo' && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleCapture}
              style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 0 }}
            >
              <Camera size={28} />
            </button>
            {capturingSecondAngle ? (
              <button className="btn btn-secondary" onClick={cancelSecondAngle}>
                Annuler 2ème angle
              </button>
            ) : onCancel ? (
              <button className="btn btn-secondary" onClick={() => {
                if (streamRef.current) stopCamera(streamRef.current);
                setIsStreaming(false);
                onCancel();
              }}>
                Annuler
              </button>
            ) : null}
          </>
        )}

        {/* Streaming in video mode: record button */}
        {isStreaming && !recording && mode === 'video' && !capturingSecondAngle && (
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

        {/* Recording */}
        {recording && (
          <button
            className="btn btn-danger"
            onClick={stopRecording}
            style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 0, animation: 'pulse-glow 1s infinite' }}
          >
            <StopCircle size={28} />
          </button>
        )}

        {/* Preview: retake, 2nd angle, validate */}
        {hasPreview && (
          <>
            <button className="btn btn-secondary" onClick={handleRetake}>
              <RotateCcw size={18} /> Reprendre
            </button>
            {photos.length === 1 && mode === 'photo' && (
              <button className="btn btn-secondary" onClick={handleAddSecondAngle}>
                <Plus size={18} /> 2ème angle
              </button>
            )}
            <button className="btn btn-primary" onClick={handleConfirm}>
              <Check size={18} /> Valider
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
