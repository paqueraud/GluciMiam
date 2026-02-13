import { db } from '../../db';
import type { FoodDatabaseEntry } from '../../types';
import * as XLSX from 'xlsx';

export async function loadFoodDatabaseFromExcel(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  let imported = 0;
  for (const row of rows) {
    const name = String(row['Aliment'] || row['aliment'] || row['Nom'] || row['nom'] || row['Name'] || row['name'] || '').trim();
    const carbsRaw = row['Glucides % (en g/100g)'] || row['Glucides (g/100g)'] || row['glucides'] || row['Glucides'] || row['Carbs'] || row['carbs'] || row['glucides_100g'] || 0;
    const carbs = parseFloat(String(carbsRaw));

    if (name && !isNaN(carbs)) {
      const existing = await db.foodDatabase.where('name').equalsIgnoreCase(name).first();
      if (!existing) {
        await db.foodDatabase.add({
          name,
          carbsPer100g: carbs,
          source: 'local',
          category: String(row['Categorie'] || row['categorie'] || row['Category'] || ''),
        });
        imported++;
      }
    }
  }

  return imported;
}

export async function searchFoodLocal(query: string): Promise<FoodDatabaseEntry[]> {
  const lower = query.toLowerCase();
  const all = await db.foodDatabase.toArray();
  return all.filter((entry) => entry.name.toLowerCase().includes(lower));
}

export async function searchFoodMultiKeyword(query: string): Promise<FoodDatabaseEntry[]> {
  if (!query.trim()) return [];
  const keywords = query.toLowerCase().split(/[\s,;]+/).filter((k) => k.length > 2);
  if (keywords.length === 0) return [];
  const all = await db.foodDatabase.toArray();
  // Score each entry by number of matching keywords
  const scored = all
    .map((entry) => {
      const name = entry.name.toLowerCase();
      const score = keywords.filter((kw) => name.includes(kw)).length;
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.entry);
}

export async function searchFoodOnline(query: string): Promise<FoodDatabaseEntry | null> {
  try {
    // Try OpenFoodFacts
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.products && data.products.length > 0) {
        const product = data.products[0];
        const carbs = product.nutriments?.carbohydrates_100g;
        if (carbs !== undefined) {
          const entry: FoodDatabaseEntry = {
            name: product.product_name || query,
            carbsPer100g: parseFloat(carbs),
            source: 'openfoodfacts',
            category: product.categories_tags?.[0] || '',
          };
          // Save to local DB
          await db.foodDatabase.add(entry);
          return entry;
        }
      }
    }
  } catch {
    // Silent fail, return null
  }
  return null;
}

export async function findFoodCarbs(foodName: string): Promise<number | null> {
  // 1. Search local DB first
  const localResults = await searchFoodLocal(foodName);
  if (localResults.length > 0) {
    return localResults[0].carbsPer100g;
  }

  // 2. Search online
  const onlineResult = await searchFoodOnline(foodName);
  if (onlineResult) {
    return onlineResult.carbsPer100g;
  }

  return null;
}

export async function getFoodDatabaseStats(): Promise<{ total: number; bySource: Record<string, number> }> {
  const all = await db.foodDatabase.toArray();
  const bySource: Record<string, number> = {};
  for (const entry of all) {
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }
  return { total: all.length, bySource };
}
