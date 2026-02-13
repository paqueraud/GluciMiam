import { useRef, useState, useCallback } from 'react';
import { Camera, RotateCcw, Check, ImagePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { openCamera, capturePhoto, stopCamera, fileToBase64 } from '../../services/camera';

interface CameraCaptureProps {
  onCapture: (photoBase64: string) => void;
  onCancel?: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleRetake = useCallback(() => {
    setPreview(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (preview) {
      onCapture(preview);
    }
  }, [preview, onCapture]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setPreview(base64);
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
        gap: 16,
        width: '100%',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          aspectRatio: '4/3',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: '2px solid var(--border-color)',
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
            <Camera size={48} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
              Prenez une photo de votre plat avec votre index visible comme repère
            </p>
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>
            )}
          </div>
        )}

        {/* Scan line overlay */}
        {isStreaming && (
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

      <div style={{ display: 'flex', gap: 12 }}>
        {!isStreaming && !preview && (
          <>
            <button className="btn btn-primary" onClick={startCamera}>
              <Camera size={18} /> Ouvrir caméra
            </button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={18} /> Galerie
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </>
        )}

        {isStreaming && (
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
