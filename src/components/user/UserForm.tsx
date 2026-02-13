import { useState } from 'react';
import { Save, Plus, Trash2, Camera } from 'lucide-react';
import { db } from '../../db';
import type { UserProfile, InsulinSensitivity, CarbRatio, TimePeriod } from '../../types';
import { fileToBase64 } from '../../services/camera';
import { v4ID } from '../../utils/helpers';

interface UserFormProps {
  existingUser?: UserProfile;
  onSaved: () => void;
  onCancel: () => void;
}

const DEFAULT_PERIODS: TimePeriod[] = [
  { id: '1', label: 'Matin', startHour: 6, startMinute: 0, endHour: 11, endMinute: 59 },
  { id: '2', label: 'Midi', startHour: 12, startMinute: 0, endHour: 17, endMinute: 59 },
  { id: '3', label: 'Soir', startHour: 18, startMinute: 0, endHour: 23, endMinute: 59 },
  { id: '4', label: 'Nuit', startHour: 0, startMinute: 0, endHour: 5, endMinute: 59 },
];

export default function UserForm({ existingUser, onSaved, onCancel }: UserFormProps) {
  const [name, setName] = useState(existingUser?.name || '');
  const [age, setAge] = useState(existingUser?.age || 0);
  const [fingerPhoto, setFingerPhoto] = useState(existingUser?.fingerPhoto || '');
  const [fingerLengthMm, setFingerLengthMm] = useState(existingUser?.fingerLengthMm || 70);
  const [sensitivities, setSensitivities] = useState<InsulinSensitivity[]>(
    existingUser?.insulinSensitivities || DEFAULT_PERIODS.map((p) => ({ period: p, value: 50 }))
  );
  const [ratios, setRatios] = useState<CarbRatio[]>(
    existingUser?.carbRatios || DEFAULT_PERIODS.map((p) => ({ period: p, value: 10 }))
  );
  const [saving, setSaving] = useState(false);

  const handleFingerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setFingerPhoto(base64);
    }
  };

  const updateSensitivity = (index: number, field: string, value: number | string) => {
    setSensitivities((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === 'value') return { ...s, value: Number(value) };
        return { ...s, period: { ...s.period, [field]: field === 'label' ? value : Number(value) } };
      })
    );
  };

  const updateRatio = (index: number, field: string, value: number | string) => {
    setRatios((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (field === 'value') return { ...r, value: Number(value) };
        return { ...r, period: { ...r.period, [field]: field === 'label' ? value : Number(value) } };
      })
    );
  };

  const addPeriod = () => {
    const period: TimePeriod = {
      id: v4ID(),
      label: 'Nouvelle période',
      startHour: 0,
      startMinute: 0,
      endHour: 23,
      endMinute: 59,
    };
    setSensitivities((prev) => [...prev, { period, value: 50 }]);
    setRatios((prev) => [...prev, { period, value: 10 }]);
  };

  const removePeriod = (index: number) => {
    setSensitivities((prev) => prev.filter((_, i) => i !== index));
    setRatios((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const userData: UserProfile = {
      ...(existingUser?.id ? { id: existingUser.id } : {}),
      name: name.trim(),
      age,
      fingerPhoto,
      fingerLengthMm,
      insulinSensitivities: sensitivities,
      carbRatios: ratios,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (existingUser?.id) {
      await db.users.update(existingUser.id, userData);
    } else {
      await db.users.add(userData);
    }

    setSaving(false);
    onSaved();
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
    padding: 16,
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  };

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto', overflowY: 'auto', maxHeight: '85vh' }}>
      <h2 style={{
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 20,
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {existingUser ? 'Modifier le profil' : 'Nouveau profil'}
      </h2>

      {/* Identity */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Identité</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Nom / Pseudo</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Entrez un nom..." />
          </div>
          <div>
            <label className="label">Age</label>
            <input className="input" type="number" value={age || ''} onChange={(e) => setAge(Number(e.target.value))} placeholder="Age..." />
          </div>
        </div>
      </div>

      {/* Finger */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Etalon (Index)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Longueur de l'index (mm)</label>
            <input className="input" type="number" value={fingerLengthMm} onChange={(e) => setFingerLengthMm(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Photo de l'index</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {fingerPhoto && (
                <img
                  src={fingerPhoto}
                  alt="Index"
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              )}
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Camera size={16} /> {fingerPhoto ? 'Changer' : 'Photographier'}
                <input type="file" accept="image/*" capture="environment" onChange={handleFingerPhoto} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Insulin Sensitivity */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionTitle}>Sensibilité à l'insuline</div>
          <button className="btn btn-icon" onClick={addPeriod} style={{ width: 28, height: 28, background: 'var(--accent-primary)', color: 'var(--bg-primary)' }}>
            <Plus size={14} />
          </button>
        </div>
        {sensitivities.map((s, i) => (
          <div key={s.period.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 90, padding: '6px 8px', fontSize: 12 }} value={s.period.label} onChange={(e) => updateSensitivity(i, 'label', e.target.value)} />
            <input className="input" style={{ width: 50, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={s.period.startHour} onChange={(e) => updateSensitivity(i, 'startHour', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
            <input className="input" style={{ width: 50, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={s.period.endHour} onChange={(e) => updateSensitivity(i, 'endHour', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>h</span>
            <input className="input" style={{ width: 55, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={s.value} onChange={(e) => updateSensitivity(i, 'value', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>mg/dL/U</span>
            {sensitivities.length > 1 && (
              <button onClick={() => removePeriod(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Carb Ratios */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Ratio glucidique</div>
        {ratios.map((r, i) => (
          <div key={r.period.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 90, padding: '6px 8px', fontSize: 12 }} value={r.period.label} onChange={(e) => updateRatio(i, 'label', e.target.value)} />
            <input className="input" style={{ width: 50, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={r.period.startHour} onChange={(e) => updateRatio(i, 'startHour', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
            <input className="input" style={{ width: 50, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={r.period.endHour} onChange={(e) => updateRatio(i, 'endHour', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>h</span>
            <input className="input" style={{ width: 55, padding: '6px 4px', fontSize: 12, textAlign: 'center' }} type="number" value={r.value} onChange={(e) => updateRatio(i, 'value', e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>g/U</span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, paddingBottom: 40 }}>
        <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()} style={{ flex: 1 }}>
          <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
