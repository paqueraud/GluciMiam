import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { db } from '../../db';
import type { UserProfile } from '../../types';

let handLandmarker: HandLandmarker | null = null;

export async function initHandDetection(): Promise<void> {
  if (handLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numHands: 1,
  });
}

export interface HandDetectionResult {
  detected: boolean;
  indexFingerLength?: number; // in pixels
  landmarks?: { x: number; y: number; z: number }[];
}

export function detectHand(imageElement: HTMLImageElement | HTMLCanvasElement): HandDetectionResult {
  if (!handLandmarker) {
    return { detected: false };
  }

  const result = handLandmarker.detect(imageElement);

  if (!result.landmarks || result.landmarks.length === 0) {
    return { detected: false };
  }

  const landmarks = result.landmarks[0];

  // Index finger: landmarks 5 (MCP) to 8 (TIP)
  const mcp = landmarks[5];
  const pip = landmarks[6];
  const dip = landmarks[7];
  const tip = landmarks[8];

  // Calculate index finger length in pixel space
  const width = imageElement instanceof HTMLImageElement ? imageElement.naturalWidth : imageElement.width;
  const height = imageElement instanceof HTMLImageElement ? imageElement.naturalHeight : imageElement.height;

  const segments = [
    dist(mcp, pip, width, height),
    dist(pip, dip, width, height),
    dist(dip, tip, width, height),
  ];
  const indexFingerLength = segments.reduce((a, b) => a + b, 0);

  return {
    detected: true,
    indexFingerLength,
    landmarks: landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })),
  };
}

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w: number,
  h: number
): number {
  const dx = (a.x - b.x) * w;
  const dy = (a.y - b.y) * h;
  return Math.sqrt(dx * dx + dy * dy);
}

export async function identifyUserByHand(
  indexFingerLengthPx: number,
  imageWidthPx: number,
  _referenceObjectMm?: number
): Promise<UserProfile | null> {
  const users = await db.users.toArray();
  if (users.length === 0) return null;

  // Simple ratio-based matching
  // We compare the ratio of detected finger length to image width
  const detectedRatio = indexFingerLengthPx / imageWidthPx;

  let bestMatch: UserProfile | null = null;
  let bestScore = Infinity;

  for (const user of users) {
    if (!user.fingerLengthMm) continue;
    // Expected ratio based on stored finger length (rough approximation)
    // Typical photo width at 30cm distance ~ 400mm field of view
    const expectedRatio = user.fingerLengthMm / 400;
    const score = Math.abs(detectedRatio - expectedRatio);
    if (score < bestScore) {
      bestScore = score;
      bestMatch = user;
    }
  }

  // If only one user, return that user
  if (users.length === 1) return users[0];

  return bestMatch;
}

export function calculatePixelToMmRatio(
  fingerLengthPx: number,
  fingerLengthMm: number
): number {
  return fingerLengthMm / fingerLengthPx;
}
