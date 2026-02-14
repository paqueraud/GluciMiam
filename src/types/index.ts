// ===== User & Profile Types =====

export interface TimePeriod {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface InsulinSensitivity {
  period: TimePeriod;
  value: number; // mg/dL par unité d'insuline
}

export interface CarbRatio {
  period: TimePeriod;
  value: number; // grammes de glucides par unité d'insuline
}

export interface UserProfile {
  id?: number;
  name: string;
  age: number;
  fingerPhoto?: string; // base64
  fingerLengthMm: number; // longueur de l'index en mm
  insulinSensitivities: InsulinSensitivity[];
  carbRatios: CarbRatio[];
  createdAt: Date;
  updatedAt: Date;
}

// ===== Meal Session Types =====

export interface FoodItem {
  id?: number;
  sessionId: number;
  photoBase64: string;
  photoTimestamp: Date;
  userContext?: string; // contexte textuel ajouté par l'utilisateur
  detectedFoodName: string;
  estimatedWeightG: number;
  estimatedCarbsG: number;
  carbsPer100g?: number;
  correctedCarbsG?: number;
  llmResponse?: string;
  confidence?: number;
}

// ===== Meal Pump Tracking =====

export interface MealSession {
  id?: number;
  userId: number;
  startedAt: Date;
  endedAt?: Date;
  totalCarbsG: number;
  carbsEnteredInPump: number;
  isActive: boolean;
  notes?: string;
}


// ===== Food Database Types =====

export interface FoodDatabaseEntry {
  id?: number;
  name: string;
  carbsPer100g: number;
  source: 'local' | 'anses' | 'openfoodfacts' | 'manual';
  category?: string;
}

// ===== LLM Types =====

export type LLMProvider = 'claude' | 'chatgpt' | 'gemini' | 'perplexity';

export interface LLMConfig {
  id?: number;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  isActive: boolean;
}

export interface LLMFoodEntry {
  foodName: string;
  estimatedWeightG: number;
  carbsPer100g: number;
  totalCarbsG: number;
  confidence: number;
  reasoning?: string;
}

// Alias for backward compatibility
export type LLMAnalysisResult = LLMFoodEntry;

// ===== Correction Learning Types =====

export interface CorrectionPattern {
  id?: number;
  userId: number;
  foodName: string;        // nom normalisé (lowercase, trimmed)
  weightRatio: number;     // ratio poids corrigé / estimé
  carbsRatio: number;      // ratio glucides corrigés / estimés
  createdAt: Date;
}

// ===== Image Cache Types =====

export interface ImageCacheEntry {
  id?: number;
  userId: number;
  imageHash: string;         // hash perceptuel (256 bits en hex)
  foodResults: LLMFoodEntry[];
  sessionDate: Date;
  userContext?: string;
}

// ===== Analysis Progress Types =====

export interface AnalysisProgress {
  phase: 'optimizing' | 'pass1' | 'pass1-done' | 'bdd-lookup' | 'pass2' | 'pass2-streaming' | 'post-processing' | 'done';
  foodNames?: string[];
  partialFoods?: LLMFoodEntry[];
  message?: string;
}

export type OnProgress = (progress: AnalysisProgress) => void;

// ===== Export/Import Types =====

export interface ExportData {
  version: string;
  exportedAt: string;
  users: UserProfile[];
  sessions: MealSession[];
  foodItems: FoodItem[];
  foodDatabase: FoodDatabaseEntry[];
  llmConfigs: LLMConfig[];
}

// ===== App State Types =====

export interface AppState {
  currentUserId: number | null;
  activeSessionId: number | null;
  isMenuOpen: boolean;
}
