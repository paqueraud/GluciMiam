import type { LLMConfig, LLMAnalysisResult, LLMProvider, LLMFoodEntry, ImageCacheEntry } from '../../types';
import { db } from '../../db';
import { searchFoodMultiKeyword, searchFoodOnline } from '../food';
import { optimizeImageForLLM, computePerceptualHash, hammingDistance } from '../camera';

const PROVIDER_URLS: Record<LLMProvider, string> = {
  claude: 'https://api.anthropic.com/v1/messages',
  chatgpt: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  perplexity: 'https://api.perplexity.ai/chat/completions',
};

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: 'claude-sonnet-4-5-20250929',
  chatgpt: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  perplexity: 'sonar-pro',
};

// ─── Meal time context ─────────────────────────────────────────────

function getMealTimeContext(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'petit-déjeuner (matin)';
  if (hour >= 10 && hour < 12) return 'collation matinale';
  if (hour >= 12 && hour < 14) return 'déjeuner (midi)';
  if (hour >= 14 && hour < 17) return 'collation / goûter (après-midi)';
  if (hour >= 17 && hour < 21) return 'dîner (soir)';
  return 'collation nocturne';
}

// ─── Prompts for 2-pass analysis ────────────────────────────────────

function buildPass1Prompt(fingerLengthMm: number, imageCount: number, userContext?: string): string {
  const mealTime = getMealTimeContext();
  const multiAngle = imageCount > 1
    ? `\nATTENTION : ${imageCount} photos du MÊME plat sous des angles différents sont fournies. Ce sont des vues différentes du MÊME repas, PAS des plats différents. Ne liste chaque aliment qu'UNE SEULE fois.`
    : '';
  const contextLine = userContext
    ? `\nL'utilisateur a identifié ce plat comme : "${userContext}".`
    : '';

  return `Tu es un expert en nutrition. Identifie TOUS les aliments DISTINCTS visibles dans ce plat/repas.
Un index de ${fingerLengthMm}mm est visible comme étalon de taille.
Ce repas est pris au moment du ${mealTime}.${multiAngle}${contextLine}
IMPORTANT : liste chaque aliment une seule fois, même si tu vois plusieurs images. Les images montrent le même plat.
Réponds UNIQUEMENT en JSON valide:
{"foods":["nom aliment 1 en français","nom aliment 2 en français",...]}`;
}

function buildPass2Prompt(
  fingerLengthMm: number,
  imageCount: number,
  foodsWithCarbs: { name: string; carbsPer100g: number | null }[],
  userContext?: string,
): string {
  const mealTime = getMealTimeContext();
  const multiAngle = imageCount > 1
    ? `\nATTENTION : ${imageCount} photos du MÊME plat sous des angles différents sont fournies. Ce sont des vues différentes du MÊME repas. Utilise les différentes perspectives pour mieux estimer les volumes et poids. Ne duplique PAS les aliments : chaque aliment ne doit apparaître qu'UNE SEULE FOIS dans ta réponse.`
    : '';
  const contextLine = userContext
    ? `\nL'utilisateur a identifié ce plat comme : "${userContext}". Utilise cette information en priorité.\n`
    : '';

  const carbsLines = foodsWithCarbs.map((f) => {
    if (f.carbsPer100g !== null) {
      return `- ${f.name} : ${f.carbsPer100g}g glucides/100g (BDD locale, utiliser cette valeur)`;
    }
    return `- ${f.name} : glucides/100g inconnus, estime toi-même`;
  }).join('\n');

  return `Tu es un expert en nutrition pour diabétiques. Estime le poids et les glucides de chaque aliment dans cette photo.
Un index de ${fingerLengthMm}mm est visible comme étalon de taille.
Ce repas est pris au moment du ${mealTime}.${multiAngle}${contextLine}
DONNÉES NUTRITIONNELLES :
${carbsLines}

Pour les aliments dont les glucides/100g sont fournis par la BDD locale, utilise EXACTEMENT ces valeurs.
Calcule totalCarbsG = estimatedWeightG * carbsPer100g / 100.

IMPORTANT : Retourne EXACTEMENT ${foodsWithCarbs.length} aliment(s) dans ta réponse (un par aliment listé ci-dessus), pas plus, pas moins.

Réponds UNIQUEMENT en JSON valide:
{"foods":[{"foodName":"nom en français","estimatedWeightG":poids_grammes,"carbsPer100g":glucides_pour_100g,"totalCarbsG":total_glucides,"confidence":0.0_a_1.0,"reasoning":"explication courte"}]}
Si impossible: {"error":"raison","needsRetake":true}`;
}

// Legacy single-food prompt (fallback)
function buildSinglePrompt(fingerLengthMm: number, userContext?: string, dbHints?: string): string {
  const mealTime = getMealTimeContext();
  const contextLine = userContext
    ? `\nIMPORTANT - L'utilisateur a identifié ce plat comme : "${userContext}". Utilise cette information en priorité pour identifier l'aliment.\n`
    : '';
  const dbLine = dbHints
    ? `\nDONNÉES DE RÉFÉRENCE (base de données locale, à utiliser EN PRIORITÉ pour carbsPer100g) :\n${dbHints}\nUtilise ces valeurs de glucides/100g au lieu de tes propres estimations si un aliment correspond.\n`
    : '';

  return `Tu es un expert en nutrition pour diabétiques. Analyse cette photo de plat/aliment.
Un index de ${fingerLengthMm}mm est visible comme étalon de taille.
Ce repas est pris au moment du ${mealTime}. Utilise cette information pour lever les ambiguïtés sur le type de plat.${contextLine}${dbLine}
Réponds UNIQUEMENT en JSON valide:
{"foodName":"nom en français","estimatedWeightG":poids_grammes,"carbsPer100g":glucides_pour_100g,"totalCarbsG":total_glucides,"confidence":0.0_a_1.0,"reasoning":"explication courte"}
Si impossible: {"error":"raison","needsRetake":true}`;
}

// ─── LLM Provider calls (multi-image) ──────────────────────────────

async function callClaude(config: LLMConfig, images: string[], prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.claude;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = images.map((img) => {
    const base64Data = img.includes(',') ? img.split(',')[1] : img;
    return {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
    };
  });
  content.push({ type: 'text', text: prompt });

  const response = await fetch(PROVIDER_URLS.claude, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'user', content }] }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API erreur ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

async function callChatGPT(config: LLMConfig, images: string[], prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.chatgpt;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of images) {
    const dataUrl = img.includes(',') ? img : `data:image/jpeg;base64,${img}`;
    content.push({ type: 'image_url', image_url: { url: dataUrl } });
  }

  const response = await fetch(PROVIDER_URLS.chatgpt, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: 2048 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ChatGPT API erreur ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(config: LLMConfig, images: string[], prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.gemini;
  const url = `${PROVIDER_URLS.gemini}/${model}:generateContent?key=${config.apiKey}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: prompt }];
  for (const img of images) {
    const base64Data = img.includes(',') ? img.split(',')[1] : img;
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API erreur ${response.status}: ${err}`);
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(`Gemini: aucune réponse générée.${blockReason ? ` Raison: ${blockReason}` : ''} Vérifiez votre clé API et le modèle choisi.`);
  }

  const candidate = data.candidates[0];
  if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'END_TURN') {
    console.warn(`Gemini finishReason: ${candidate.finishReason}`);
  }

  return candidate.content.parts
    .map((p: { text?: string }) => p.text || '')
    .join('');
}

async function callPerplexity(config: LLMConfig, _images: string[], prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.perplexity;
  const response = await fetch(PROVIDER_URLS.perplexity, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt + '\n\n(Note: image analysis non disponible via cette API, décris les aliments mentionnés)' }],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API erreur ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Generic caller ─────────────────────────────────────────────────

function callProvider(config: LLMConfig, images: string[], prompt: string): Promise<string> {
  switch (config.provider) {
    case 'claude': return callClaude(config, images, prompt);
    case 'chatgpt': return callChatGPT(config, images, prompt);
    case 'gemini': return callGemini(config, images, prompt);
    case 'perplexity': return callPerplexity(config, images, prompt);
    default: throw new Error(`Provider non supporté: ${config.provider}`);
  }
}

// ─── JSON extraction / parsing ──────────────────────────────────────

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  const start = text.indexOf('{');
  if (start === -1) throw new Error(`Pas de JSON trouvé dans: ${text.substring(0, 300)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return text.substring(start, i + 1); }
  }

  const partial = text.substring(start);
  const closings = ['}', '"}', '0}', '0.5}', '""}', ']}', '"]}', '0]}', '}]}', '""}]}'];
  for (const closing of closings) {
    try { const repaired = partial + closing; JSON.parse(repaired); return repaired; } catch { /* continue */ }
  }
  return partial;
}

function extractFieldString(text: string, key: string): string | undefined {
  const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i');
  return text.match(regex)?.[1];
}

function extractFieldNumber(text: string, key: string): number | undefined {
  const regex = new RegExp(`"${key}"\\s*:\\s*([\\d.]+)`, 'i');
  const match = text.match(regex);
  return match ? parseFloat(match[1]) : undefined;
}

function repairTruncatedJSON(text: string): LLMAnalysisResult | null {
  const foodName = extractFieldString(text, 'foodName');
  const estimatedWeightG = extractFieldNumber(text, 'estimatedWeightG');
  const carbsPer100g = extractFieldNumber(text, 'carbsPer100g');
  const totalCarbsG = extractFieldNumber(text, 'totalCarbsG');
  const confidence = extractFieldNumber(text, 'confidence');
  const reasoning = extractFieldString(text, 'reasoning');

  if (!foodName) return null;

  const computedTotal = totalCarbsG ??
    (estimatedWeightG && carbsPer100g ? Math.round((estimatedWeightG * carbsPer100g / 100) * 10) / 10 : undefined);
  if (computedTotal === undefined) return null;

  return {
    foodName,
    estimatedWeightG: estimatedWeightG ?? 0,
    carbsPer100g: carbsPer100g ?? 0,
    totalCarbsG: computedTotal,
    confidence: confidence ?? 0.5,
    reasoning: reasoning ?? 'Réponse reconstruite depuis une réponse LLM tronquée',
  };
}

// Parse pass 1 response: extract food names list
function parsePass1Response(text: string): string[] {
  const jsonStr = extractJSON(text);
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.foods)) return [...new Set(parsed.foods.filter((f: unknown) => typeof f === 'string' && f.trim()) as string[])];
    if (Array.isArray(parsed)) return [...new Set(parsed.filter((f: unknown) => typeof f === 'string' && f.trim()) as string[])];
  } catch { /* continue */ }

  // Fallback: try to extract food names from text
  const foods: string[] = [];
  const matches = jsonStr.matchAll(/"([^"]{2,60})"/g);
  for (const m of matches) {
    if (!['foods', 'error', 'needsRetake'].includes(m[1])) foods.push(m[1]);
  }
  return foods;
}

// Parse pass 2 response: extract array of LLMFoodEntry
function parsePass2Response(text: string): LLMFoodEntry[] | { error: string; needsRetake: boolean } {
  const jsonStr = extractJSON(text);
  try {
    const parsed = JSON.parse(jsonStr);
    if ('error' in parsed) return parsed as { error: string; needsRetake: boolean };
    const foods = Array.isArray(parsed.foods) ? parsed.foods : Array.isArray(parsed) ? parsed : [parsed];
    return foods.map((f: LLMFoodEntry) => ({
      foodName: f.foodName || 'Inconnu',
      estimatedWeightG: f.estimatedWeightG || 0,
      carbsPer100g: f.carbsPer100g || 0,
      totalCarbsG: f.totalCarbsG || Math.round((f.estimatedWeightG * f.carbsPer100g / 100) * 10) / 10 || 0,
      confidence: f.confidence ?? 0.5,
      reasoning: f.reasoning,
    }));
  } catch {
    // Try single-item repair
    const repaired = repairTruncatedJSON(jsonStr);
    if (repaired) return [repaired];
    throw new Error(`JSON incomplet: ${jsonStr.substring(0, 200)}... Réessayez.`);
  }
}

// Legacy single-item parser
function parseSingleResponse(text: string): LLMAnalysisResult | { error: string; needsRetake: boolean } {
  const jsonStr = extractJSON(text);
  try { return JSON.parse(jsonStr); } catch {
    const repaired = repairTruncatedJSON(jsonStr);
    if (repaired) return repaired;
    throw new Error(`JSON incomplet: ${jsonStr.substring(0, 200)}... Réessayez.`);
  }
}

// ─── Food DB helpers ────────────────────────────────────────────────

async function getActiveConfig(): Promise<LLMConfig> {
  let config = await db.llmConfigs.where('isActive').equals(1).first();
  if (!config) {
    const all = await db.llmConfigs.toArray();
    config = all.find((c) => c.isActive) || all[all.length - 1];
  }
  if (!config) throw new Error('Aucun LLM configuré. Allez dans le menu > Configuration LLM.');
  return config;
}

async function fetchWithTimeout(fetchFn: () => Promise<string>, timeoutMs = 30000): Promise<string> {
  return Promise.race([
    fetchFn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: le LLM n\'a pas répondu dans les 30 secondes. Réessayez.')), timeoutMs)
    ),
  ]);
}

async function lookupFoodDB(userContext?: string): Promise<string> {
  if (!userContext) return '';
  try {
    const matches = await searchFoodMultiKeyword(userContext);
    if (matches.length > 0) return matches.map((m) => `- ${m.name}: ${m.carbsPer100g}g glucides/100g`).join('\n');
  } catch { /* silent */ }
  return '';
}

async function lookupFoodCarbsForNames(foodNames: string[]): Promise<{ name: string; carbsPer100g: number | null }[]> {
  const results: { name: string; carbsPer100g: number | null }[] = [];
  for (const name of foodNames) {
    try {
      const matches = await searchFoodMultiKeyword(name);
      if (matches.length > 0) {
        results.push({ name, carbsPer100g: matches[0].carbsPer100g });
        continue;
      }
    } catch { /* continue */ }
    results.push({ name, carbsPer100g: null });
  }
  return results;
}

async function correctWithFoodDB(result: LLMAnalysisResult): Promise<LLMAnalysisResult> {
  try {
    const matches = await searchFoodMultiKeyword(result.foodName);
    if (matches.length > 0) {
      const bestMatch = matches[0];
      const dbCarbs = bestMatch.carbsPer100g;
      if (Math.abs(result.carbsPer100g - dbCarbs) > 2) {
        const correctedTotal = Math.round((result.estimatedWeightG * dbCarbs / 100) * 10) / 10;
        return {
          ...result,
          carbsPer100g: dbCarbs,
          totalCarbsG: correctedTotal,
          reasoning: `${result.reasoning} [Corrigé via BDD locale: ${bestMatch.name} = ${dbCarbs}g/100g]`,
        };
      }
    }
    const onlineMatch = await searchFoodOnline(result.foodName);
    if (onlineMatch && Math.abs(result.carbsPer100g - onlineMatch.carbsPer100g) > 5) {
      const correctedTotal = Math.round((result.estimatedWeightG * onlineMatch.carbsPer100g / 100) * 10) / 10;
      return {
        ...result,
        carbsPer100g: onlineMatch.carbsPer100g,
        totalCarbsG: correctedTotal,
        reasoning: `${result.reasoning} [Corrigé via OpenFoodFacts: ${onlineMatch.name} = ${onlineMatch.carbsPer100g}g/100g]`,
      };
    }
  } catch { /* silent */ }
  return result;
}

// ─── Deduplication ──────────────────────────────────────────────────

function normalizeFoodName(name: string): string {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '') // keep only alphanumeric
    .replace(/\s+/g, ' ');
}

function foodNamesMatch(a: string, b: string): boolean {
  const na = normalizeFoodName(a);
  const nb = normalizeFoodName(b);
  if (na === nb) return true;
  // Check if one contains the other (e.g. "riz" and "riz blanc")
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function deduplicateFoods(foods: LLMFoodEntry[], maxCount?: number): LLMFoodEntry[] {
  const result: LLMFoodEntry[] = [];
  for (const food of foods) {
    const existing = result.find((r) => foodNamesMatch(r.foodName, food.foodName));
    if (existing) {
      // Keep the entry with higher confidence
      if (food.confidence > existing.confidence) {
        const idx = result.indexOf(existing);
        result[idx] = food;
      }
    } else {
      result.push(food);
    }
  }
  // Hard cap: never return more than maxCount entries
  if (maxCount && result.length > maxCount) {
    result.sort((a, b) => b.confidence - a.confidence);
    return result.slice(0, maxCount);
  }
  return result;
}

// ─── Correction learning ────────────────────────────────────────────

async function applyCorrectionPatterns(
  foods: LLMFoodEntry[],
  userId: number,
): Promise<LLMFoodEntry[]> {
  const result: LLMFoodEntry[] = [];
  for (const food of foods) {
    const normalized = food.foodName.toLowerCase().trim();
    try {
      const patterns = await db.correctionPatterns
        .where('[userId+foodName]')
        .equals([userId, normalized])
        .reverse()
        .limit(10)
        .toArray();

      // Fallback: query by userId only and filter by foodName
      let usablePatterns = patterns;
      if (usablePatterns.length === 0) {
        const allForUser = await db.correctionPatterns
          .where('userId')
          .equals(userId)
          .toArray();
        usablePatterns = allForUser
          .filter((p) => p.foodName === normalized)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 10);
      }

      if (usablePatterns.length === 0) {
        result.push(food);
        continue;
      }

      const avgWeightRatio = usablePatterns.reduce((s, p) => s + p.weightRatio, 0) / usablePatterns.length;
      const avgCarbsRatio = usablePatterns.reduce((s, p) => s + p.carbsRatio, 0) / usablePatterns.length;

      const adjusted = { ...food };
      const notes: string[] = [];

      if (Math.abs(avgWeightRatio - 1.0) > 0.05) {
        adjusted.estimatedWeightG = Math.round(food.estimatedWeightG * avgWeightRatio);
        adjusted.totalCarbsG = Math.round((adjusted.estimatedWeightG * adjusted.carbsPer100g / 100) * 10) / 10;
        notes.push(`poids x${avgWeightRatio.toFixed(2)}`);
      }
      if (Math.abs(avgCarbsRatio - 1.0) > 0.05 && notes.length === 0) {
        adjusted.totalCarbsG = Math.round(food.totalCarbsG * avgCarbsRatio * 10) / 10;
        notes.push(`glucides x${avgCarbsRatio.toFixed(2)}`);
      }

      if (notes.length > 0) {
        adjusted.reasoning = `${food.reasoning || ''} [Apprentissage: ${notes.join(', ')} sur ${usablePatterns.length} correction(s)]`;
      }

      result.push(adjusted);
    } catch {
      result.push(food);
    }
  }
  return result;
}

// ─── Image cache ────────────────────────────────────────────────────

const CACHE_HAMMING_THRESHOLD = 20;

export async function findCachedAnalysis(
  imageDataUrl: string,
  userId: number,
): Promise<{ entry: ImageCacheEntry; distance: number } | null> {
  try {
    const hash = await computePerceptualHash(imageDataUrl);
    if (!hash) return null;

    const entries = await db.imageCache
      .where('userId')
      .equals(userId)
      .toArray();

    let bestMatch: { entry: ImageCacheEntry; distance: number } | null = null;
    for (const entry of entries) {
      const dist = hammingDistance(hash, entry.imageHash);
      if (dist < CACHE_HAMMING_THRESHOLD) {
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { entry, distance: dist };
        }
      }
    }
    return bestMatch;
  } catch {
    return null;
  }
}

export async function saveCacheEntry(
  imageDataUrl: string,
  userId: number,
  results: LLMFoodEntry[],
  sessionDate: Date,
  userContext?: string,
): Promise<void> {
  try {
    const hash = await computePerceptualHash(imageDataUrl);
    if (!hash) return;
    await db.imageCache.add({
      userId,
      imageHash: hash,
      foodResults: results,
      sessionDate,
      userContext,
    });
  } catch { /* silent */ }
}

// ─── Main analysis: 2-pass multi-food ───────────────────────────────

export async function analyzeFoodMulti(
  images: string[],
  fingerLengthMm: number,
  userContext?: string,
  userId?: number,
): Promise<LLMFoodEntry[]> {
  const config = await getActiveConfig();

  // Optimize all images
  const optimizedImages = await Promise.all(images.map((img) => optimizeImageForLLM(img)));

  // ── PASS 1: Identify foods ──
  const pass1Prompt = buildPass1Prompt(fingerLengthMm, optimizedImages.length, userContext);
  const pass1Text = await fetchWithTimeout(
    () => callProvider(config, optimizedImages, pass1Prompt),
    30000,
  );

  const foodNames = parsePass1Response(pass1Text);

  // If pass 1 returned nothing useful, fall back to single-item analysis
  if (foodNames.length === 0) {
    return fallbackSingleAnalysis(config, optimizedImages, fingerLengthMm, userContext);
  }

  // ── BDD lookup between passes ──
  const foodsWithCarbs = await lookupFoodCarbsForNames(foodNames);

  // ── PASS 2: Quantify with known carbs ──
  const pass2Prompt = buildPass2Prompt(fingerLengthMm, optimizedImages.length, foodsWithCarbs, userContext);
  const pass2Text = await fetchWithTimeout(
    () => callProvider(config, optimizedImages, pass2Prompt),
    30000,
  );

  const pass2Result = parsePass2Response(pass2Text);

  if ('error' in pass2Result) {
    throw new Error(pass2Result.error);
  }

  // Deduplicate: merge entries with the same foodName (LLM may duplicate with multi-angle)
  // Hard cap to the number of foods identified in pass 1
  const deduped = deduplicateFoods(pass2Result, foodNames.length);

  // Post-correction: for foods where BDD was not found in pass 1, try OpenFoodFacts
  const correctedFoods: LLMFoodEntry[] = [];
  for (const food of deduped) {
    const corrected = await correctWithFoodDB(food);
    correctedFoods.push(corrected);
  }

  // Apply user correction learning patterns
  if (userId) {
    return applyCorrectionPatterns(correctedFoods, userId);
  }

  return correctedFoods;
}

// Fallback: single-item analysis (used when pass 1 returns no foods)
async function fallbackSingleAnalysis(
  config: LLMConfig,
  images: string[],
  fingerLengthMm: number,
  userContext?: string,
): Promise<LLMFoodEntry[]> {
  const dbHints = await lookupFoodDB(userContext);
  const prompt = buildSinglePrompt(fingerLengthMm, userContext, dbHints || undefined);
  const responseText = await fetchWithTimeout(
    () => callProvider(config, images, prompt),
    30000,
  );
  const result = parseSingleResponse(responseText);
  if ('error' in result) throw new Error(result.error);
  const corrected = await correctWithFoodDB(result as LLMAnalysisResult);
  return [corrected];
}

// ─── Legacy wrapper (single image, single result) ───────────────────

export async function analyzeFood(
  imageBase64: string,
  fingerLengthMm: number,
  userContext?: string,
): Promise<LLMAnalysisResult> {
  const results = await analyzeFoodMulti([imageBase64], fingerLengthMm, userContext);
  return results[0];
}

// ─── Test / Config ──────────────────────────────────────────────────

export async function testLLMConnection(): Promise<{ success: boolean; message: string; provider: string; model: string }> {
  try {
    const config = await getActiveConfig();
    const model = config.model || DEFAULT_MODELS[config.provider];

    let testOk = false;
    let responseInfo = '';

    if (config.provider === 'gemini') {
      const url = `${PROVIDER_URLS.gemini}/${model}:generateContent?key=${config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Réponds uniquement "OK" sans rien d\'autre.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      if (!response.ok) { const err = await response.text(); return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model }; }
      const data = await response.json();
      responseInfo = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Réponse vide';
      testOk = true;
    } else if (config.provider === 'claude') {
      const response = await fetch(PROVIDER_URLS.claude, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Réponds uniquement "OK".' }] }),
      });
      if (!response.ok) { const err = await response.text(); return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model }; }
      const data = await response.json();
      responseInfo = data.content?.[0]?.text || 'Réponse vide';
      testOk = true;
    } else if (config.provider === 'chatgpt') {
      const response = await fetch(PROVIDER_URLS.chatgpt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Réponds uniquement "OK".' }], max_tokens: 10 }),
      });
      if (!response.ok) { const err = await response.text(); return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model }; }
      const data = await response.json();
      responseInfo = data.choices?.[0]?.message?.content || 'Réponse vide';
      testOk = true;
    } else {
      return { success: false, message: 'Test non supporté pour ce provider', provider: config.provider, model };
    }

    return { success: testOk, message: `Connexion OK ! Réponse: "${responseInfo.trim()}"`, provider: config.provider, model };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Erreur inconnue', provider: 'inconnu', model: 'inconnu' };
  }
}

export async function saveLLMConfig(config: Omit<LLMConfig, 'id'>): Promise<void> {
  await db.llmConfigs.toCollection().modify({ isActive: false });
  const existing = await db.llmConfigs.where('provider').equals(config.provider).first();
  if (existing) {
    await db.llmConfigs.update(existing.id!, { apiKey: config.apiKey, model: config.model, isActive: true });
  } else {
    await db.llmConfigs.add(config as LLMConfig);
  }
}

export async function getLLMConfigByProvider(provider: LLMProvider): Promise<LLMConfig | undefined> {
  return db.llmConfigs.where('provider').equals(provider).first();
}

export async function getActiveLLMConfig(): Promise<LLMConfig | undefined> {
  let config = await db.llmConfigs.where('isActive').equals(1).first();
  if (!config) {
    const all = await db.llmConfigs.toArray();
    config = all.find((c) => c.isActive) || all[all.length - 1];
  }
  return config;
}

export { DEFAULT_MODELS, PROVIDER_URLS };
