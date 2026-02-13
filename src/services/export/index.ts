import { db } from '../../db';
import type { ExportData } from '../../types';

export async function exportDatabase(): Promise<string> {
  const data: ExportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    users: await db.users.toArray(),
    sessions: await db.sessions.toArray(),
    foodItems: await db.foodItems.toArray(),
    foodDatabase: await db.foodDatabase.toArray(),
    llmConfigs: await db.llmConfigs.toArray(),
  };

  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<{ imported: boolean; message: string }> {
  try {
    const data: ExportData = JSON.parse(jsonString);

    if (!data.version || !data.users) {
      return { imported: false, message: 'Format de fichier invalide' };
    }

    // Clear existing data
    await db.users.clear();
    await db.sessions.clear();
    await db.foodItems.clear();
    await db.foodDatabase.clear();
    await db.llmConfigs.clear();

    // Import
    if (data.users.length) await db.users.bulkAdd(data.users);
    if (data.sessions.length) await db.sessions.bulkAdd(data.sessions);
    if (data.foodItems.length) await db.foodItems.bulkAdd(data.foodItems);
    if (data.foodDatabase.length) await db.foodDatabase.bulkAdd(data.foodDatabase);
    if (data.llmConfigs.length) await db.llmConfigs.bulkAdd(data.llmConfigs);

    return {
      imported: true,
      message: `Importé: ${data.users.length} utilisateurs, ${data.sessions.length} sessions, ${data.foodItems.length} aliments photographiés, ${data.foodDatabase.length} entrées BDD`,
    };
  } catch (e) {
    return { imported: false, message: `Erreur d'import: ${e instanceof Error ? e.message : 'Inconnu'}` };
  }
}

export function downloadJSON(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
