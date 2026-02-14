import { create } from 'zustand';
import { db } from '../db';
import type { UserProfile, MealSession, FoodItem, LLMConfig } from '../types';

interface AppStore {
  // State
  currentUser: UserProfile | null;
  activeSession: MealSession | null;
  sessionFoodItems: FoodItem[];
  users: UserProfile[];
  isMenuOpen: boolean;
  activeLLMConfig: LLMConfig | null;
  currentPhotoIndex: number;

  // Actions
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  loadUsers: () => Promise<void>;
  setCurrentUser: (user: UserProfile | null) => void;
  startSession: (userId: number) => Promise<MealSession>;
  endSession: () => Promise<void>;
  loadActiveSession: () => Promise<void>;
  addFoodItem: (item: Omit<FoodItem, 'id'>) => Promise<FoodItem>;
  updateFoodItem: (id: number, updates: Partial<FoodItem>) => Promise<void>;
  deleteFoodItem: (id: number) => Promise<void>;
  refreshSessionItems: () => Promise<void>;
  setCurrentPhotoIndex: (index: number) => void;
  deleteUser: (id: number) => Promise<void>;
  loadActiveLLMConfig: () => Promise<void>;
  getTotalCarbs: () => number;
  updateCarbsEnteredInPump: (value: number) => Promise<void>;
  getCarbsRemaining: () => number;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentUser: null,
  activeSession: null,
  sessionFoodItems: [],
  users: [],
  isMenuOpen: false,
  activeLLMConfig: null,
  currentPhotoIndex: 0,

  setMenuOpen: (open) => set({ isMenuOpen: open }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),

  loadUsers: async () => {
    const users = await db.users.toArray();
    set({ users });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  startSession: async (userId: number) => {
    const session: MealSession = {
      userId,
      startedAt: new Date(),
      totalCarbsG: 0,
      carbsEnteredInPump: 0,
      isActive: true,
    };
    const id = await db.sessions.add(session);
    const created = { ...session, id };
    set({ activeSession: created, sessionFoodItems: [], currentPhotoIndex: 0 });
    return created;
  },

  endSession: async () => {
    const { activeSession, sessionFoodItems } = get();
    if (activeSession?.id) {
      const totalCarbs = sessionFoodItems.reduce(
        (sum, item) => sum + (item.correctedCarbsG ?? item.estimatedCarbsG),
        0
      );
      await db.sessions.update(activeSession.id, {
        isActive: false,
        endedAt: new Date(),
        totalCarbsG: totalCarbs,
      });
    }
    set({ activeSession: null, sessionFoodItems: [], currentPhotoIndex: 0 });
  },

  loadActiveSession: async () => {
    const session = await db.sessions.where('isActive').equals(1).first();
    if (session) {
      const items = await db.foodItems.where('sessionId').equals(session.id!).toArray();
      const user = await db.users.get(session.userId);
      set({
        activeSession: session,
        sessionFoodItems: items,
        currentUser: user || null,
        currentPhotoIndex: items.length > 0 ? items.length - 1 : 0,
      });
    }
  },

  addFoodItem: async (item) => {
    const id = await db.foodItems.add(item as FoodItem);
    const created = { ...item, id } as FoodItem;
    set((s) => {
      const items = [...s.sessionFoodItems, created];
      return { sessionFoodItems: items, currentPhotoIndex: items.length - 1 };
    });
    const { activeSession } = get();
    if (activeSession?.id) {
      const total = get().getTotalCarbs();
      await db.sessions.update(activeSession.id, { totalCarbsG: total });
      set((s) => ({
        activeSession: s.activeSession ? { ...s.activeSession, totalCarbsG: total } : null,
      }));
    }
    return created;
  },

  updateFoodItem: async (id, updates) => {
    // Get original item BEFORE update to compute correction ratios
    const originalItem = get().sessionFoodItems.find((item) => item.id === id);

    await db.foodItems.update(id, updates);
    set((s) => ({
      sessionFoodItems: s.sessionFoodItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
    const { activeSession, currentUser } = get();
    if (activeSession?.id) {
      const total = get().getTotalCarbs();
      await db.sessions.update(activeSession.id, { totalCarbsG: total });
      set((s) => ({
        activeSession: s.activeSession ? { ...s.activeSession, totalCarbsG: total } : null,
      }));
    }

    // Store correction pattern for learning
    if (originalItem && currentUser?.id) {
      const hasWeightCorrection = updates.estimatedWeightG !== undefined
        && originalItem.estimatedWeightG > 0
        && updates.estimatedWeightG !== originalItem.estimatedWeightG;
      const hasCarbsCorrection = updates.correctedCarbsG !== undefined
        && originalItem.estimatedCarbsG > 0
        && updates.correctedCarbsG !== originalItem.estimatedCarbsG;

      if (hasWeightCorrection || hasCarbsCorrection) {
        const weightRatio = hasWeightCorrection
          ? (updates.estimatedWeightG as number) / originalItem.estimatedWeightG
          : 1.0;
        const carbsRatio = hasCarbsCorrection
          ? (updates.correctedCarbsG as number) / originalItem.estimatedCarbsG
          : 1.0;

        if (weightRatio !== 1.0 || carbsRatio !== 1.0) {
          try {
            await db.correctionPatterns.add({
              userId: currentUser.id,
              foodName: originalItem.detectedFoodName.toLowerCase().trim(),
              weightRatio,
              carbsRatio,
              createdAt: new Date(),
            });
          } catch { /* silent */ }
        }
      }
    }
  },

  deleteFoodItem: async (id) => {
    await db.foodItems.delete(id);
    const { sessionFoodItems, currentPhotoIndex } = get();
    const newItems = sessionFoodItems.filter((item) => item.id !== id);
    const newIndex = Math.min(currentPhotoIndex, Math.max(0, newItems.length - 1));
    set({ sessionFoodItems: newItems, currentPhotoIndex: newIndex });
    const { activeSession } = get();
    if (activeSession?.id) {
      const total = get().getTotalCarbs();
      await db.sessions.update(activeSession.id, { totalCarbsG: total });
      set((s) => ({
        activeSession: s.activeSession ? { ...s.activeSession, totalCarbsG: total } : null,
      }));
    }
  },

  refreshSessionItems: async () => {
    const { activeSession } = get();
    if (activeSession?.id) {
      const items = await db.foodItems.where('sessionId').equals(activeSession.id).toArray();
      set({ sessionFoodItems: items });
    }
  },

  setCurrentPhotoIndex: (index) => set({ currentPhotoIndex: index }),

  deleteUser: async (id) => {
    await db.users.delete(id);
    const { currentUser, users } = get();
    set({
      users: users.filter((u) => u.id !== id),
      currentUser: currentUser?.id === id ? null : currentUser,
    });
  },

  loadActiveLLMConfig: async () => {
    const config = await db.llmConfigs.where('isActive').equals(1).first();
    set({ activeLLMConfig: config || null });
  },

  getTotalCarbs: () => {
    const { sessionFoodItems } = get();
    return sessionFoodItems.reduce(
      (sum, item) => sum + (item.correctedCarbsG ?? item.estimatedCarbsG),
      0
    );
  },

  updateCarbsEnteredInPump: async (value: number) => {
    const { activeSession } = get();
    if (activeSession?.id) {
      await db.sessions.update(activeSession.id, { carbsEnteredInPump: value });
      set({
        activeSession: { ...activeSession, carbsEnteredInPump: value },
      });
    }
  },

  getCarbsRemaining: () => {
    const { activeSession } = get();
    const total = get().getTotalCarbs();
    const entered = activeSession?.carbsEnteredInPump ?? 0;
    return Math.max(0, total - entered);
  },
}));
