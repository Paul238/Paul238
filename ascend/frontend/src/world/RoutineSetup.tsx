import { Utensils } from 'lucide-react';
import { useState } from 'react';
import { ACTIVITY_LEVELS, DEFAULT_NUTRITION, computedTargets } from '../domain/nutrition';
import type { NutritionProfile } from '../domain/types';
import { DEFAULT_PLAN, DayPlanForm, planToTasks, type DayPlan } from './DayPlan';
import { useApp } from '../state/store';
import { Modal, Switch } from '../ui/components';
import { fmt } from '../ui/format';

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
  const [plan, setPlan] = useState<DayPlan>(DEFAULT_PLAN);
  const [nutri, setNutri] = useState<NutritionProfile>(state.settings.nutrition ?? DEFAULT_NUTRITION);
  const [useNutri, setUseNutri] = useState<boolean>(true);

  function save() {
    const tasks = planToTasks(plan, existing);
    tasks.forEach((t) => api.saveTask(t));
    if (useNutri) api.updateSettings({ nutrition: nutri });
    notify({ kind: 'success', title: 'Ziua ta e în program', body: tasks.length ? `${tasks.length} repere și mese adăugate.` : 'Nimic nou de adăugat.' });
    onClose();
  }

  return (
    <Modal
      size="lg"
      title="Ziua ta"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" onClick={save}>
            Adaugă-le în program
          </button>
        </>
      }
    >
      <p className="text-2">Spune-mi cum arată de obicei ziua ta. Fiecare reper apare în lista zilei: la ore notezi ora reală, la mese ce ai mâncat.</p>
      <DayPlanForm value={plan} onChange={setPlan} existing={existing} />
      <div className="plan-card" style={{ ['--c' as string]: '#3cc48d' }}>
        <div className="plan-head">
          <span className="plan-icon">
            <Utensils size={18} />
          </span>
          <b className="grow">Ținte de nutriție</b>
          <Switch checked={useNutri} onChange={setUseNutri} label="Ținte de nutriție" />
        </div>
        {useNutri && (
          <div className="plan-body">
            <NutritionForm value={nutri} onChange={setNutri} />
          </div>
        )}
      </div>
    </Modal>
  );
}
