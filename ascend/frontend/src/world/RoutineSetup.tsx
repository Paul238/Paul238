import { AlarmClock, Utensils } from 'lucide-react';
import { useState } from 'react';
import { ACTIVITY_LEVELS, DEFAULT_NUTRITION, computedTargets } from '../domain/nutrition';
import { uid } from '../domain/id';
import type { AttributeKey, NutritionProfile, Task, TimeMode } from '../domain/types';
import { useApp } from '../state/store';
import { Modal, Switch } from '../ui/components';
import { fmt } from '../ui/format';

interface Row {
  on: boolean;
  title: string;
  kind: 'time' | 'meal';
  time: string;
  mode: TimeMode;
  tolerance: number;
  points: number;
  attributes: AttributeKey[];
  workdays: boolean;
}

const DEFAULT_ROWS: Row[] = [
  { on: true, title: 'Trezire', kind: 'time', time: '07:00', mode: 'by', tolerance: 15, points: 15, attributes: ['discipline', 'health'], workdays: false },
  { on: true, title: 'Mic dejun', kind: 'meal', time: '08:00', mode: 'log', tolerance: 0, points: 5, attributes: ['health'], workdays: false },
  { on: true, title: 'Ajuns la muncă / școală', kind: 'time', time: '09:00', mode: 'by', tolerance: 5, points: 15, attributes: ['career', 'discipline'], workdays: true },
  { on: true, title: 'Prânz', kind: 'meal', time: '13:00', mode: 'log', tolerance: 0, points: 5, attributes: ['health'], workdays: false },
  { on: false, title: 'Gustare', kind: 'meal', time: '16:00', mode: 'log', tolerance: 0, points: 3, attributes: ['health'], workdays: false },
  { on: true, title: 'Terminat programul', kind: 'time', time: '17:00', mode: 'log', tolerance: 0, points: 5, attributes: ['career'], workdays: true },
  { on: true, title: 'Cină', kind: 'meal', time: '19:00', mode: 'log', tolerance: 0, points: 5, attributes: ['health'], workdays: false },
  { on: false, title: 'Culcare', kind: 'time', time: '23:00', mode: 'by', tolerance: 15, points: 10, attributes: ['health', 'discipline'], workdays: false },
];

const MODE_LABEL: Record<TimeMode, string> = { by: 'cel târziu', after: 'cel devreme', log: 'doar notez' };

export function NutritionForm({ value, onChange }: { value: NutritionProfile; onChange: (v: NutritionProfile) => void }) {
  const t = computedTargets(value);
  const set = (patch: Partial<NutritionProfile>) => onChange({ ...value, ...patch });
  const num = (v: string, d: number) => (Number(v) > 0 ? Number(v) : d);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-4" style={{ gap: 10 }}>
        <div className="field">
          <label>Sex</label>
          <div className="segmented full">
            <button type="button" className={value.sex === 'm' ? 'active' : ''} onClick={() => set({ sex: 'm' })}>
              M
            </button>
            <button type="button" className={value.sex === 'f' ? 'active' : ''} onClick={() => set({ sex: 'f' })}>
              F
            </button>
          </div>
        </div>
        <div className="field">
          <label>Vârstă</label>
          <input className="input num" type="number" value={value.age} onChange={(e) => set({ age: num(e.target.value, value.age) })} />
        </div>
        <div className="field">
          <label>Înălțime (cm)</label>
          <input className="input num" type="number" value={value.heightCm} onChange={(e) => set({ heightCm: num(e.target.value, value.heightCm) })} />
        </div>
        <div className="field">
          <label>Greutate (kg)</label>
          <input className="input num" type="number" value={value.weightKg} onChange={(e) => set({ weightKg: num(e.target.value, value.weightKg) })} />
        </div>
      </div>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <div className="field">
          <label>Activitate</label>
          <select className="select" value={value.activity} onChange={(e) => set({ activity: Number(e.target.value) })}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Obiectiv</label>
          <div className="segmented full">
            {(
              [
                ['cut', 'Slăbire'],
                ['maintain', 'Menținere'],
                ['bulk', 'Masă'],
              ] as const
            ).map(([g, l]) => (
              <button key={g} type="button" className={value.goal === g ? 'active' : ''} onClick={() => set({ goal: g })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="targets-box">
        {(
          [
            ['kcal', 'Calorii', 'kcal'],
            ['protein', 'Proteine', 'g'],
            ['carbs', 'Carbohidrați', 'g'],
            ['fat', 'Grăsimi', 'g'],
          ] as const
        ).map(([k, l, u]) => (
          <div key={k}>
            <span className="tiny muted">{l}</span>
            <input
              className="input num"
              type="number"
              placeholder={String(t[k])}
              value={value.manual?.[k] ?? ''}
              onChange={(e) => set({ manual: { ...value.manual, [k]: Number(e.target.value) || undefined } })}
            />
            <span className="tiny muted">
              calculat: {fmt(t[k])} {u}
            </span>
          </div>
        ))}
      </div>
      <p className="hint">Țintele sunt calculate cu formula Mifflin-St Jeor. Dacă ai valori de la un nutriționist, scrie-le în câmpuri: au prioritate.</p>
      <div className="row">
        <span className="small">Credite pentru o zi perfect încadrată</span>
        <div className="input-suffix" style={{ width: 110 }}>
          <input className="input num" type="number" min={0} value={value.points} onChange={(e) => set({ points: Math.max(0, Number(e.target.value) || 0) })} />
          <span>cr</span>
        </div>
      </div>
    </div>
  );
}

export function RoutineSetup({ onClose }: { onClose: () => void }) {
  const { state, api, notify } = useApp();
  const existing = new Set(state.tasks.filter((t) => !t.archived).map((t) => t.title.toLowerCase()));
  const [rows, setRows] = useState<Row[]>(() => DEFAULT_ROWS.map((r) => ({ ...r, on: r.on && !existing.has(r.title.toLowerCase()) })));
  const [nutri, setNutri] = useState<NutritionProfile>(state.settings.nutrition ?? DEFAULT_NUTRITION);
  const [useNutri, setUseNutri] = useState(true);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function save() {
    const now = new Date().toISOString();
    const tasks: Task[] = rows
      .filter((r) => r.on && r.title.trim())
      .map((r) => ({
        id: uid('t'),
        kind: r.kind,
        title: r.title.trim(),
        time: r.time,
        timeMode: r.kind === 'time' ? r.mode : undefined,
        tolerance: r.kind === 'time' ? r.tolerance : undefined,
        points: r.points,
        attributes: r.attributes,
        schedule: { kind: 'daily', days: r.workdays ? [1, 2, 3, 4, 5] : [] },
        special: false,
        archived: false,
        createdAt: now,
      }));
    tasks.forEach((t) => api.saveTask(t));
    if (useNutri) api.updateSettings({ nutrition: nutri });
    notify({ kind: 'success', title: 'Ziua ta e configurată', body: `${tasks.length} repere și mese adăugate pe drum.` });
    onClose();
  }

  return (
    <Modal
      size="lg"
      title="Configurează-ți ziua"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" onClick={save}>
            Salvează ziua mea
          </button>
        </>
      }
    >
      <p className="text-2">Reperele fixe apar în fiecare zi pe drum și în desfășurător. La repere notezi ora reală și primești punctele doar dacă te-ai încadrat. La mese notezi ce ai mâncat.</p>
      <div className="routine-list">
        {rows.map((r, i) => (
          <div key={i} className={`routine-row ${r.on ? '' : 'off'}`}>
            <Switch checked={r.on} onChange={(v) => set(i, { on: v })} label={r.title} />
            <span className="routine-icon">{r.kind === 'meal' ? <Utensils size={15} /> : <AlarmClock size={15} />}</span>
            <input className="input" value={r.title} onChange={(e) => set(i, { title: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
            <input className="input num" type="time" value={r.time} onChange={(e) => set(i, { time: e.target.value || r.time })} style={{ width: 110 }} />
            {r.kind === 'time' && (
              <>
                <select className="select" value={r.mode} onChange={(e) => set(i, { mode: e.target.value as TimeMode })} style={{ width: 130 }}>
                  {(Object.keys(MODE_LABEL) as TimeMode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
                {r.mode !== 'log' && (
                  <div className="input-suffix" style={{ width: 92 }} title="Toleranță">
                    <input className="input num" type="number" min={0} value={r.tolerance} onChange={(e) => set(i, { tolerance: Math.max(0, Number(e.target.value) || 0) })} />
                    <span>±min</span>
                  </div>
                )}
              </>
            )}
            <label className="chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={r.workdays} onChange={(e) => set(i, { workdays: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> L–V
            </label>
            <div className="input-suffix" style={{ width: 84 }}>
              <input className="input num" type="number" min={0} value={r.points} onChange={(e) => set(i, { points: Math.max(0, Number(e.target.value) || 0) })} />
              <span>pct</span>
            </div>
          </div>
        ))}
      </div>

      <div className="row-between mt-8">
        <h3>Profil nutrițional</h3>
        <Switch checked={useNutri} onChange={setUseNutri} label="Profil nutrițional" />
      </div>
      {useNutri && <NutritionForm value={nutri} onChange={setNutri} />}
    </Modal>
  );
}
