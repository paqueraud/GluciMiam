import { useState, useEffect } from 'react';
import { Save, CheckCircle, Wifi, WifiOff, Loader } from 'lucide-react';
import type { LLMProvider, LLMConfig } from '../../types';
import { saveLLMConfig, getActiveLLMConfig, DEFAULT_MODELS, testLLMConnection } from '../../services/llm';
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
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Recommandé - Stable, rapide, vision' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Plus précis, meilleur raisonnement' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Version précédente, très stable' },
];

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Le plus puissant, raisonnement avancé' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Excellent rapport performance/coût' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Rapide et économique' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Performant, bonne analyse visuelle' },
];

export default function LLMSettings({ onClose }: LLMSettingsProps) {
  const [provider, setProvider] = useState<LLMProvider>('claude');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
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
    setTimeout(() => onClose(), 1500);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Entrez une clé API d\'abord' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    // Save config first so test uses it
    const config: Omit<LLMConfig, 'id'> = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_MODELS[provider],
      isActive: true,
    };
    await saveLLMConfig(config);
    await loadActiveLLMConfig();

    const result = await testLLMConnection();
    setTestResult({ success: result.success, message: `[${result.provider}/${result.model}] ${result.message}` });
    setTesting(false);
  };

  const modelList = provider === 'gemini' ? GEMINI_MODELS : provider === 'claude' ? CLAUDE_MODELS : null;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        paddingBottom: 100,
        maxWidth: 500,
        margin: '0 auto',
        width: '100%',
      }}>
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
                  setModel(
                    p.id === 'gemini' ? GEMINI_MODELS[0].id
                    : p.id === 'claude' ? CLAUDE_MODELS[0].id
                    : DEFAULT_MODELS[p.id]
                  );
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

        {/* Model selector for Claude & Gemini */}
        {modelList && (
          <div style={{ marginBottom: 16 }}>
            <label className="label">Modèle</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {modelList.map((m) => (
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
        {!modelList && (
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
      </div>

      {/* Fixed bottom buttons */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 500,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Test result */}
        {testResult && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult.success ? 'var(--success)' : 'var(--danger)'}`,
            fontSize: 12,
            color: testResult.success ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            wordBreak: 'break-word',
          }}>
            {testResult.success ? <Wifi size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            {testResult.message}
          </div>
        )}

        {/* Test button */}
        <button
          className="btn btn-secondary"
          onClick={handleTest}
          disabled={testing || !apiKey.trim()}
          style={{ width: '100%', gap: 8 }}
        >
          {testing ? (
            <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Test en cours...</>
          ) : (
            <><Wifi size={14} /> Tester la connexion</>
          )}
        </button>

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
    </div>
  );
}
