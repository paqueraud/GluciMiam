import { useState, useRef } from 'react';
import { Download, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { exportDatabase, importDatabase, downloadJSON } from '../../services/export';
import { loadFoodDatabaseFromExcel } from '../../services/food';

interface ImportExportProps {
  mode: 'import' | 'export';
  onClose: () => void;
}

export default function ImportExport({ mode, onClose }: ImportExportProps) {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const json = await exportDatabase();
      const filename = `glucimiam_backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJSON(json, filename);
      setStatus({ type: 'success', message: `Export réussi : ${filename}` });
    } catch (e) {
      setStatus({ type: 'error', message: `Erreur: ${e instanceof Error ? e.message : 'Inconnu'}` });
    }
    setLoading(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const result = await importDatabase(text);
      setStatus({
        type: result.imported ? 'success' : 'error',
        message: result.message,
      });
    } catch (err) {
      setStatus({ type: 'error', message: `Erreur: ${err instanceof Error ? err.message : 'Inconnu'}` });
    }
    setLoading(false);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const count = await loadFoodDatabaseFromExcel(file);
      setStatus({ type: 'success', message: `${count} aliments importés depuis Excel` });
    } catch (err) {
      setStatus({ type: 'error', message: `Erreur: ${err instanceof Error ? err.message : 'Inconnu'}` });
    }
    setLoading(false);
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
        {mode === 'export' ? 'Exporter la base de données' : 'Importer des données'}
      </h2>

      {mode === 'export' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Exportez toutes vos données (profils, historique, base alimentaire) au format JSON.
          </p>
          <button className="btn btn-primary" onClick={handleExport} disabled={loading} style={{ width: '100%' }}>
            <Upload size={18} /> {loading ? 'Export en cours...' : 'Exporter tout en JSON'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="glass"
            style={{
              padding: 16,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 8 }}>
              Importer BDD JSON
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
              Restaurez une sauvegarde complète (profils, sessions, etc.)
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <Download size={16} /> Sélectionner fichier JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              style={{ display: 'none' }}
            />
          </div>

          <div
            className="glass"
            style={{
              padding: 16,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 8 }}>
              Importer BDD Alimentaire Excel
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
              Importez la base de données alimentaire depuis un fichier Excel (.xlsx)
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => excelInputRef.current?.click()}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <Download size={16} /> Sélectionner fichier Excel
            </button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleImportExcel}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: status.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: status.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {status.message}
        </div>
      )}

      <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
        Fermer
      </button>
    </div>
  );
}
