import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import type { LLMProvider, LLMConfig } from '../../types';
import { saveLLMConfig, getActiveLLMConfig, DEFAULT_MODELS } from '../../services/llm';
import { useAppStore } from '../../stores/appStore';

interface LLMSettingsProps {
  onClose: () => void;
}

const PROVIDERS: { id: LLMProvider; name: string; description: string }[] = [
  { id: 'claude', name: 'Claude (Anthropic)', description: 'Recommandé - Meilleure analyse visuelle' },
  { id: 'chatgpt', name: 'ChatGPT (OpenAI)', description: 'GPT-4o avec vision' },
  { id: 'gemini', name: 'Gemini (Google)', description: 'Gratuit - Gemini 3 Flash' },
  { id: 'perplexity', name: 'Perplexity', description: 'Recherche augmentée (pas de vision)' },
];

const GEMINI_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', description: 'Le plus récent, rapide et performant' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', description: 'Plus puissant, meilleur raisonnement' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Stable, rapide' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable, plus précis' },
];

export default function LLMSettings({ onClose }: LLMSettingsProps) {
  const [provider, setProvider] = useState<LLMProvider>('claude');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { loadActiveLLMConfig } = useAppStore();

  useEffect(() => {
    getActiveLLMConfig().then((config) => {
      if (config) {
        setProvider(config.provider);
        setApiKey(config.apiKey);
        setModel(config.model || '');
      }
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);

    const config: Omit<LLMConfig, 'id'> = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_MODELS[provider],
      isActive: true,
    };

    await saveLLMConfig(config);
    await loadActiveLLMConfig();
    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 1000);
  };

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 20,
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Configuration LLM
      </h2>

      {/* Provider selection */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">Fournisseur IA</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(DEFAULT_MODELS[p.id]);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 16px',
                background: provider === p.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${provider === p.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                boxShadow: provider === p.id ? 'var(--accent-glow)' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={{ marginBottom: 16 }}>
        <label className="label">Clé API</label>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Entrez votre clé API ${PROVIDERS.find((p) => p.id === provider)?.name || ''}...`}
        />
      </div>

      {/* Gemini model selector */}
      {provider === 'gemini' && (
        <div style={{ marginBottom: 16 }}>
          <label className="label">Modèle Gemini</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {GEMINI_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '10px 14px',
                  background: model === m.id ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
                  border: `1px solid ${model === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model override (other providers) */}
      {provider !== 'gemini' && (
        <div style={{ marginBottom: 24 }}>
          <label className="label">Modèle (optionnel)</label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODELS[provider]}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Laissez vide pour utiliser le modèle par défaut
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          style={{ flex: 1 }}
        >
          {saved ? (
            <><CheckCircle size={16} /> Sauvegardé !</>
          ) : saving ? (
            'Enregistrement...'
          ) : (
            <><Save size={16} /> Enregistrer</>
          )}
        </button>
      </div>
    </div>
  );
}
