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
  detectedFoodName: string;
  estimatedWeightG: number;
  estimatedCarbsG: number;
  correctedCarbsG?: number;
  llmResponse?: string;
  confidence?: number;
}

export interface MealSession {
  id?: number;
  userId: number;
  startedAt: Date;
  endedAt?: Date;
  totalCarbsG: number;
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

export interface LLMAnalysisResult {
  foodName: string;
  estimatedWeightG: number;
  carbsPer100g: number;
  totalCarbsG: number;
  confidence: number;
  reasoning?: string;
}

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
