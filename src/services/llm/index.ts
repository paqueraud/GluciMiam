import type { LLMConfig, LLMAnalysisResult, LLMProvider } from '../../types';
import { db } from '../../db';

const PROVIDER_URLS: Record<LLMProvider, string> = {
  claude: 'https://api.anthropic.com/v1/messages',
  chatgpt: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  perplexity: 'https://api.perplexity.ai/chat/completions',
};

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: 'claude-opus-4-6',
  chatgpt: 'gpt-4o',
  gemini: 'gemini-3-flash',
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

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "foodName": "nom du plat/aliment en français",
  "estimatedWeightG": nombre_en_grammes,
  "carbsPer100g": glucides_pour_100g,
  "totalCarbsG": total_glucides_en_grammes,
  "confidence": nombre_entre_0_et_1,
  "reasoning": "explication courte de ton estimation"
}

Si tu ne peux pas identifier l'aliment ou si la photo est floue/insuffisante, réponds :
{
  "error": "description du problème",
  "needsRetake": true
}`;
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
    throw new Error(`Claude API error: ${response.status} - ${err}`);
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
    throw new Error(`ChatGPT API error: ${response.status} - ${err}`);
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
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
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
    throw new Error(`Perplexity API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseResponse(text: string): LLMAnalysisResult | { error: string; needsRetake: boolean } {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error('Impossible de parser la réponse du LLM');
  }
  return JSON.parse(jsonMatch[1].trim());
}

export async function analyzeFood(
  imageBase64: string,
  fingerLengthMm: number,
  userContext?: string
): Promise<LLMAnalysisResult> {
  const config = await db.llmConfigs.where('isActive').equals(1).first();
  if (!config) {
    throw new Error('Aucun LLM configuré. Configurez un LLM dans le menu.');
  }

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

export async function saveLLMConfig(config: Omit<LLMConfig, 'id'>): Promise<void> {
  // Deactivate all existing configs
  await db.llmConfigs.toCollection().modify({ isActive: false });
  // Add or update
  await db.llmConfigs.add(config as LLMConfig);
}

export async function getActiveLLMConfig(): Promise<LLMConfig | undefined> {
  return db.llmConfigs.where('isActive').equals(1).first();
}

export { DEFAULT_MODELS, PROVIDER_URLS };
