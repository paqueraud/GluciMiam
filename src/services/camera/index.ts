export async function openCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

export function capturePhoto(videoElement: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Optimize an image for LLM analysis:
 * 1. Resize so the longest side is <= maxSize (default 1024)
 * 2. Apply auto-levels (histogram stretching) for better contrast
 * Returns a JPEG data URL.
 */
export function optimizeImageForLLM(dataUrl: string, maxSize = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Compute target dimensions (preserve aspect ratio)
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round(h * (maxSize / w));
          w = maxSize;
        } else {
          w = Math.round(w * (maxSize / h));
          h = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // Auto-levels: stretch histogram per channel
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Sample pixels to find min/max per channel (sample every 4th pixel for speed)
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
      }

      // Only apply if there's meaningful room to stretch (avoid noise amplification)
      const threshold = 20; // minimum range gap to bother correcting
      const needsR = (rMin > threshold || rMax < 255 - threshold) && rMax > rMin;
      const needsG = (gMin > threshold || gMax < 255 - threshold) && gMax > gMin;
      const needsB = (bMin > threshold || bMax < 255 - threshold) && bMax > bMin;

      if (needsR || needsG || needsB) {
        // Use 1st/99th percentile to avoid outlier-driven stretching
        const rHist = new Uint32Array(256);
        const gHist = new Uint32Array(256);
        const bHist = new Uint32Array(256);
        for (let i = 0; i < data.length; i += 4) {
          rHist[data[i]]++;
          gHist[data[i + 1]]++;
          bHist[data[i + 2]]++;
        }

        const totalPixels = w * h;
        const lo = Math.floor(totalPixels * 0.01);
        const hi = Math.floor(totalPixels * 0.99);

        function percentile(hist: Uint32Array, target: number): number {
          let sum = 0;
          for (let i = 0; i < 256; i++) {
            sum += hist[i];
            if (sum >= target) return i;
          }
          return 255;
        }

        const rLo = percentile(rHist, lo), rHi = percentile(rHist, hi);
        const gLo = percentile(gHist, lo), gHi = percentile(gHist, hi);
        const bLo = percentile(bHist, lo), bHi = percentile(bHist, hi);

        // Build lookup tables
        function buildLUT(cLo: number, cHi: number): Uint8Array {
          const lut = new Uint8Array(256);
          const range = cHi - cLo || 1;
          for (let i = 0; i < 256; i++) {
            lut[i] = Math.max(0, Math.min(255, Math.round(((i - cLo) / range) * 255)));
          }
          return lut;
        }

        const rLUT = buildLUT(rLo, rHi);
        const gLUT = buildLUT(gLo, gHi);
        const bLUT = buildLUT(bLo, bHi);

        for (let i = 0; i < data.length; i += 4) {
          data[i] = rLUT[data[i]];
          data[i + 1] = gLUT[data[i + 1]];
          data[i + 2] = bLUT[data[i + 2]];
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}
