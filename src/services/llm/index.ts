import type { LLMConfig, LLMAnalysisResult, LLMProvider } from '../../types';
import { db } from '../../db';
import { searchFoodMultiKeyword, searchFoodOnline } from '../food';

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

function buildPrompt(fingerLengthMm: number, userContext?: string, dbHints?: string): string {
  const contextLine = userContext
    ? `\nIMPORTANT - L'utilisateur a identifié ce plat comme : "${userContext}". Utilise cette information en priorité pour identifier l'aliment.\n`
    : '';

  const dbLine = dbHints
    ? `\nDONNÉES DE RÉFÉRENCE (base de données locale, à utiliser EN PRIORITÉ pour carbsPer100g) :\n${dbHints}\nUtilise ces valeurs de glucides/100g au lieu de tes propres estimations si un aliment correspond.\n`
    : '';

  return `Tu es un expert en nutrition pour diabétiques. Analyse cette photo de plat/aliment.
Un index de ${fingerLengthMm}mm est visible comme étalon de taille.${contextLine}${dbLine}
Réponds UNIQUEMENT en JSON valide:
{"foodName":"nom en français","estimatedWeightG":poids_grammes,"carbsPer100g":glucides_pour_100g,"totalCarbsG":total_glucides,"confidence":0.0_a_1.0,"reasoning":"explication courte"}
Si impossible: {"error":"raison","needsRetake":true}`;
}

async function callClaude(config: LLMConfig, imageBase64: string, prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.claude;
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const response = await fetch(PROVIDER_URLS.claude, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Data,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API erreur ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callChatGPT(config: LLMConfig, imageBase64: string, prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.chatgpt;
  const base64Data = imageBase64.includes(',') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const response = await fetch(PROVIDER_URLS.chatgpt, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64Data } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ChatGPT API erreur ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(config: LLMConfig, imageBase64: string, prompt: string): Promise<string> {
  const model = config.model || DEFAULT_MODELS.gemini;
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const url = `${PROVIDER_URLS.gemini}/${model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
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

  // Check finish reason for truncation
  if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'END_TURN') {
    console.warn(`Gemini finishReason: ${candidate.finishReason}`);
  }

  // Concatenate ALL parts from the response
  const fullText = candidate.content.parts
    .map((p: { text?: string }) => p.text || '')
    .join('');

  return fullText;
}

async function callPerplexity(config: LLMConfig, _imageBase64: string, prompt: string): Promise<string> {
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
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API erreur ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function extractJSON(text: string): string {
  // Try markdown code block first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // Find JSON by matching balanced braces
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
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }

  // JSON is truncated - try multiple repair strategies
  const partial = text.substring(start);

  // Strategy 1-4: try various closings
  const closings = ['}', '"}', '0}', '0.5}', '""}'];
  for (const closing of closings) {
    try {
      const repaired = partial + closing;
      JSON.parse(repaired);
      return repaired;
    } catch { /* continue */ }
  }

  // Strategy 5: extract fields individually from truncated JSON
  return partial;
}

function extractFieldString(text: string, key: string): string | undefined {
  const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i');
  const match = text.match(regex);
  return match?.[1];
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

  // We need at minimum foodName to consider it valid
  if (!foodName) return null;

  // Calculate totalCarbsG from parts if missing
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

function parseResponse(text: string): LLMAnalysisResult | { error: string; needsRetake: boolean } {
  const jsonStr = extractJSON(text);

  // Try direct parse first
  try {
    return JSON.parse(jsonStr);
  } catch {
    // JSON is invalid/truncated - try field-by-field repair
    const repaired = repairTruncatedJSON(jsonStr);
    if (repaired) return repaired;
    throw new Error(`JSON incomplet: ${jsonStr.substring(0, 200)}... Réessayez.`);
  }
}

async function getActiveConfig(): Promise<LLMConfig> {
  // Try both boolean true and number 1 for Dexie compatibility
  let config = await db.llmConfigs.where('isActive').equals(1).first();
  if (!config) {
    // Fallback: get last config added
    const all = await db.llmConfigs.toArray();
    config = all.find((c) => c.isActive) || all[all.length - 1];
  }
  if (!config) {
    throw new Error('Aucun LLM configuré. Allez dans le menu > Configuration LLM.');
  }
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
    if (matches.length > 0) {
      return matches
        .map((m) => `- ${m.name}: ${m.carbsPer100g}g glucides/100g`)
        .join('\n');
    }
  } catch { /* silent */ }
  return '';
}

async function correctWithFoodDB(result: LLMAnalysisResult): Promise<LLMAnalysisResult> {
  try {
    // Search local DB with the detected food name
    const matches = await searchFoodMultiKeyword(result.foodName);
    if (matches.length > 0) {
      const bestMatch = matches[0];
      const dbCarbs = bestMatch.carbsPer100g;
      // If the LLM's carbsPer100g differs significantly from DB, use DB value
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
    // Try OpenFoodFacts as fallback
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
  } catch { /* silent, return original */ }
  return result;
}

export async function analyzeFood(
  imageBase64: string,
  fingerLengthMm: number,
  userContext?: string
): Promise<LLMAnalysisResult> {
  const config = await getActiveConfig();

  // Search food DB to include hints in prompt
  const dbHints = await lookupFoodDB(userContext);
  const prompt = buildPrompt(fingerLengthMm, userContext, dbHints || undefined);

  const callLLM = () => {
    switch (config.provider) {
      case 'claude':
        return callClaude(config, imageBase64, prompt);
      case 'chatgpt':
        return callChatGPT(config, imageBase64, prompt);
      case 'gemini':
        return callGemini(config, imageBase64, prompt);
      case 'perplexity':
        return callPerplexity(config, imageBase64, prompt);
      default:
        throw new Error(`Provider non supporté: ${config.provider}`);
    }
  };

  const responseText = await fetchWithTimeout(callLLM, 30000);

  const result = parseResponse(responseText);

  if ('error' in result) {
    throw new Error(result.error);
  }

  // Correct carbsPer100g using food database
  const corrected = await correctWithFoodDB(result as LLMAnalysisResult);
  return corrected;
}

export async function testLLMConnection(): Promise<{ success: boolean; message: string; provider: string; model: string }> {
  try {
    const config = await getActiveConfig();
    const model = config.model || DEFAULT_MODELS[config.provider];

    // Simple text-only test
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
      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model };
      }
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
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Réponds uniquement "OK".' }],
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model };
      }
      const data = await response.json();
      responseInfo = data.content?.[0]?.text || 'Réponse vide';
      testOk = true;
    } else if (config.provider === 'chatgpt') {
      const response = await fetch(PROVIDER_URLS.chatgpt, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Réponds uniquement "OK".' }],
          max_tokens: 10,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: `Erreur ${response.status}: ${err}`, provider: config.provider, model };
      }
      const data = await response.json();
      responseInfo = data.choices?.[0]?.message?.content || 'Réponse vide';
      testOk = true;
    } else {
      return { success: false, message: 'Test non supporté pour ce provider', provider: config.provider, model };
    }

    return {
      success: testOk,
      message: `Connexion OK ! Réponse: "${responseInfo.trim()}"`,
      provider: config.provider,
      model,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Erreur inconnue',
      provider: 'inconnu',
      model: 'inconnu',
    };
  }
}

export async function saveLLMConfig(config: Omit<LLMConfig, 'id'>): Promise<void> {
  // Deactivate all existing configs
  await db.llmConfigs.toCollection().modify({ isActive: false });

  // Check if a config for this provider already exists
  const existing = await db.llmConfigs.where('provider').equals(config.provider).first();

  if (existing) {
    await db.llmConfigs.update(existing.id!, {
      apiKey: config.apiKey,
      model: config.model,
      isActive: true,
    });
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
