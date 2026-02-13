import Dexie, { type Table } from 'dexie';
import type { UserProfile, MealSession, FoodItem, FoodDatabaseEntry, LLMConfig } from '../types';

export class GluciMiamDB extends Dexie {
  users!: Table<UserProfile, number>;
  sessions!: Table<MealSession, number>;
  foodItems!: Table<FoodItem, number>;
  foodDatabase!: Table<FoodDatabaseEntry, number>;
  llmConfigs!: Table<LLMConfig, number>;

  constructor() {
    super('GluciMiamDB');
    this.version(1).stores({
      users: '++id, name',
      sessions: '++id, userId, isActive, startedAt',
      foodItems: '++id, sessionId, photoTimestamp',
      foodDatabase: '++id, name, source',
      llmConfigs: '++id, provider, isActive',
    });
  }
}

export const db = new GluciMiamDB();
