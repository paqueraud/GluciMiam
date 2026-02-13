import { useAppStore } from '../../stores/appStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoViewer() {
  const { sessionFoodItems, currentPhotoIndex, setCurrentPhotoIndex } = useAppStore();

  if (sessionFoodItems.length === 0) return null;

  const currentItem = sessionFoodItems[currentPhotoIndex];
  if (!currentItem) return null;

  const goTo = (dir: -1 | 1) => {
    const next = currentPhotoIndex + dir;
    if (next >= 0 && next < sessionFoodItems.length) {
      setCurrentPhotoIndex(next);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Photo */}
      <div
        style={{
          width: '100%',
          aspectRatio: '16/10',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          position: 'relative',
        }}
      >
        <img
          src={currentItem.photoBase64}
          alt={currentItem.detectedFoodName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Counter badge */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {currentPhotoIndex + 1} / {sessionFoodItems.length}
        </div>
      </div>

      {/* Navigation arrows */}
      {sessionFoodItems.length > 1 && (
        <>
          <button
            onClick={() => goTo(-1)}
            disabled={currentPhotoIndex === 0}
            style={{
              position: 'absolute',
              left: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPhotoIndex === 0 ? 'default' : 'pointer',
              opacity: currentPhotoIndex === 0 ? 0.3 : 1,
              color: 'var(--text-primary)',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goTo(1)}
            disabled={currentPhotoIndex === sessionFoodItems.length - 1}
            style={{
              position: 'absolute',
              right: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPhotoIndex === sessionFoodItems.length - 1 ? 'default' : 'pointer',
              opacity: currentPhotoIndex === sessionFoodItems.length - 1 ? 0.3 : 1,
              color: 'var(--text-primary)',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}
