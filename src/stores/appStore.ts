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
  refreshSessionItems: () => Promise<void>;
  setCurrentPhotoIndex: (index: number) => void;
  loadActiveLLMConfig: () => Promise<void>;
  getTotalCarbs: () => number;
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
    // Update session total
    const { activeSession } = get();
    if (activeSession?.id) {
      const total = get().getTotalCarbs();
      await db.sessions.update(activeSession.id, { totalCarbsG: total });
    }
    return created;
  },

  updateFoodItem: async (id, updates) => {
    await db.foodItems.update(id, updates);
    set((s) => ({
      sessionFoodItems: s.sessionFoodItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
    const { activeSession } = get();
    if (activeSession?.id) {
      const total = get().getTotalCarbs();
      await db.sessions.update(activeSession.id, { totalCarbsG: total });
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
}));
