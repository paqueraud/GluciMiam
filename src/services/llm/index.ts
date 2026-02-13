import type { LLMConfig, LLMAnalysisResult, LLMProvider } from '../../types';
import { db } from '../../db';

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

function buildPrompt(fingerLengthMm: number, userContext?: string): string {
  const contextLine = userContext
    ? `\n\nL'utilisateur a ajouté ce contexte pour t'aider : "${userContext}"\n`
    : '';

  return `Tu es un expert en nutrition et en comptage des glucides pour les diabétiques insulino-dépendants.

Analyse cette photo d'un plat/collation. Sur la photo, tu verras un doigt (index) qui sert d'étalon de mesure.
La longueur réelle de cet index est de ${fingerLengthMm}mm.

Utilise cet étalon pour estimer les dimensions et volumes des aliments visibles.${contextLine}

Réponds UNIQUEMENT en JSON valide avec ce format exact (pas de texte avant ou après, pas de markdown) :
{"foodName": "nom du plat/aliment en français", "estimatedWeightG": nombre_en_grammes, "carbsPer100g": glucides_pour_100g, "totalCarbsG": total_glucides_en_grammes, "confidence": nombre_entre_0_et_1, "reasoning": "explication courte de ton estimation"}

Si tu ne peux pas identifier l'aliment ou si la photo est floue/insuffisante, réponds :
{"error": "description du problème", "needsRetake": true}`;
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
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API erreur ${response.status}: ${err}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini: aucune réponse générée. Vérifiez votre clé API et le modèle choisi.');
  }

  return data.candidates[0].content.parts[0].text;
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

function parseResponse(text: string): LLMAnalysisResult | { error: string; needsRetake: boolean } {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*?\})/);
  if (!jsonMatch) {
    throw new Error(`Impossible de parser la réponse du LLM: ${text.substring(0, 200)}`);
  }
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    throw new Error(`JSON invalide dans la réponse LLM: ${jsonMatch[1].substring(0, 200)}`);
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

export async function analyzeFood(
  imageBase64: string,
  fingerLengthMm: number,
  userContext?: string
): Promise<LLMAnalysisResult> {
  const config = await getActiveConfig();

  const prompt = buildPrompt(fingerLengthMm, userContext);

  let responseText: string;
  switch (config.provider) {
    case 'claude':
      responseText = await callClaude(config, imageBase64, prompt);
      break;
    case 'chatgpt':
      responseText = await callChatGPT(config, imageBase64, prompt);
      break;
    case 'gemini':
      responseText = await callGemini(config, imageBase64, prompt);
      break;
    case 'perplexity':
      responseText = await callPerplexity(config, imageBase64, prompt);
      break;
    default:
      throw new Error(`Provider non supporté: ${config.provider}`);
  }

  const result = parseResponse(responseText);

  if ('error' in result) {
    throw new Error(result.error);
  }

  return result as LLMAnalysisResult;
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
  // Add new
  await db.llmConfigs.add(config as LLMConfig);
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
