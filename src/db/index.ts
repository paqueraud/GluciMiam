import Dexie, { type Table } from 'dexie';
import type { UserProfile, MealSession, FoodItem, FoodDatabaseEntry, LLMConfig } from '../types';
import seedFoods from '../data/seedFoods.json';

export class GlucIADB extends Dexie {
  users!: Table<UserProfile, number>;
  sessions!: Table<MealSession, number>;
  foodItems!: Table<FoodItem, number>;
  foodDatabase!: Table<FoodDatabaseEntry, number>;
  llmConfigs!: Table<LLMConfig, number>;

  constructor() {
    super('GlucIADB');
    this.version(1).stores({
      users: '++id, name',
      sessions: '++id, userId, isActive, startedAt',
      foodItems: '++id, sessionId, photoTimestamp',
      foodDatabase: '++id, name, source',
      llmConfigs: '++id, provider, isActive',
    });
  }
}

export const db = new GlucIADB();

// Seed food database on first launch if empty
db.on('ready', async () => {
  const count = await db.foodDatabase.count();
  if (count === 0) {
    const entries: FoodDatabaseEntry[] = (seedFoods as { name: string; carbsPer100g: number }[]).map((f) => ({
      name: f.name,
      carbsPer100g: f.carbsPer100g,
      source: 'local',
      category: '',
    }));
    await db.foodDatabase.bulkAdd(entries);
  }
});
