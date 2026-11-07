import { Briefcase, ChevronDown, Moon, Sunrise, Utensils } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { uid } from '../domain/id';
import type { Task } from '../domain/types';
import { Switch } from '../ui/components';

/** ziua ta, descrisă în cuvinte simple; se transformă în repere și mese */
export interface DayPlan {
  wake: { on: boolean; time: string };
  work: { on: boolean; place: string; start: string; end: string; workdays: boolean };
  meals: { title: string; time: string; on: boolean }[];
  sleep: { on: boolean; time: string };
  tolerance: number;
}

export const DEFAULT_PLAN: DayPlan = {
  wake: { on: true, time: '07:00' },
  work: { on: true, place: 'muncă', start: '09:00', end: '17:00', workdays: true },
  meals: [
    { title: 'Mic dejun', time: '08:00', on: true },
    { title: 'Prânz', time: '13:00', on: true },
    { title: 'Gustare', time: '16:30', on: false },
    { title: 'Cină', time: '19:30', on: true },
  ],
  sleep: { on: false, time: '23:00' },
  tolerance: 15,
};

const PLACES = ['muncă', 'școală', 'facultate', 'birou', 'sală'];

export function planToTasks(plan: DayPlan, skipTitles: Set<string> = new Set()): Task[] {
  const now = new Date().toISOString();
  const base = { special: false, archived: false, createdAt: now };
  const out: Task[] = [];
  const add = (t: Omit<Task, 'id' | 'special' | 'archived' | 'createdAt'>) => {
    if (!skipTitles.has(t.title.toLowerCase())) out.push({ ...base, ...t, id: uid('t') });
  };
  const everyDay = { kind: 'daily' as const, days: [] };
  const workDays = { kind: 'daily' as const, days: plan.work.workdays ? [1, 2, 3, 4, 5] : [] };
  if (plan.wake.on)
    add({ kind: 'time', title: 'Trezire', time: plan.wake.time, timeMode: 'by', tolerance: plan.tolerance, points: 15, attributes: ['discipline', 'health'], schedule: everyDay });
  if (plan.work.on) {
    add({ kind: 'time', title: `Ajuns la ${plan.work.place}`, time: plan.work.start, timeMode: 'by', tolerance: Math.min(plan.tolerance, 10), points: 15, attributes: ['career', 'discipline'], schedule: workDays });
    add({ kind: 'time', title: 'Terminat programul', time: plan.work.end, timeMode: 'log', tolerance: 0, points: 5, attributes: ['career'], schedule: workDays });
  }
  for (const m of plan.meals.filter((x) => x.on)) add({ kind: 'meal', title: m.title, time: m.time, points: 5, attributes: ['health'], schedule: everyDay });
  if (plan.sleep.on)
    add({ kind: 'time', title: 'Culcare', time: plan.sleep.time, timeMode: 'by', tolerance: plan.tolerance, points: 10, attributes: ['health', 'discipline'], schedule: everyDay });
  return out;
}

function TimeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <input className="input num plan-time" type="time" value={value} disabled={disabled} onChange={(e) => e.target.value && onChange(e.target.value)} />;
}

function PlanCard({ icon, title, on, onToggle, children, color }: { icon: ReactNode; title: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode; color: string }) {
  return (
    <div className={`plan-card ${on ? '' : 'off'}`} style={{ ['--c' as string]: color }}>
      <div className="plan-head">
        <span className="plan-icon">{icon}</span>
        <b className="grow">{title}</b>
        <Switch checked={on} onChange={onToggle} label={title} />
      </div>
      {on && <div className="plan-body">{children}</div>}
    </div>
  );
}

export function DayPlanForm({ value, onChange, existing }: { value: DayPlan; onChange: (p: DayPlan) => void; existing?: Set<string> }) {
  const [adv, setAdv] = useState(false);
  const set = (patch: Partial<DayPlan>) => onChange({ ...value, ...patch });
  const has = (t: string) => existing?.has(t.toLowerCase());
  return (
    <div className="plan">
      <PlanCard icon={<Sunrise size={18} />} title="Dimineața" color="#f3b04a" on={value.wake.on} onToggle={(on) => set({ wake: { ...value.wake, on } })}>
        <p className="plan-sentence">
          Vreau să mă trezesc până la <TimeField value={value.wake.time} onChange={(time) => set({ wake: { ...value.wake, time } })} />
        </p>
        {has('Trezire') && <span className="hint">Ai deja un reper „Trezire” — nu se va dubla.</span>}
      </PlanCard>

      <PlanCard icon={<Briefcase size={18} />} title="Programul" color="#8f98ff" on={value.work.on} onToggle={(on) => set({ work: { ...value.work, on } })}>
        <p className="plan-sentence">
          Merg la{' '}
          <select className="select plan-select" value={value.work.place} onChange={(e) => set({ work: { ...value.work, place: e.target.value } })}>
            {PLACES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          , ajung până la <TimeField value={value.work.start} onChange={(start) => set({ work: { ...value.work, start } })} /> și termin în jur de{' '}
          <TimeField value={value.work.end} onChange={(end) => set({ work: { ...value.work, end } })} />
        </p>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={value.work.workdays} onChange={(e) => set({ work: { ...value.work, workdays: e.target.checked } })} style={{ accentColor: 'var(--accent)' }} />
          doar de luni până vineri
        </label>
      </PlanCard>

      <PlanCard icon={<Utensils size={18} />} title="Mesele" color="#3cc48d" on={value.meals.some((m) => m.on)} onToggle={(on) => set({ meals: value.meals.map((m, i) => ({ ...m, on: on && (i !== 2 || m.on) })) })}>
        <p className="plan-sentence">Notez ce mănânc la:</p>
        <div className="plan-meals">
          {value.meals.map((m, i) => (
            <div key={m.title} className={`plan-meal ${m.on ? 'on' : ''}`}>
              <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
                <input type="checkbox" checked={m.on} onChange={(e) => set({ meals: value.meals.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })} style={{ accentColor: 'var(--accent)' }} />
                <span className="strong small">{m.title}</span>
              </label>
              <TimeField value={m.time} disabled={!m.on} onChange={(time) => set({ meals: value.meals.map((x, j) => (j === i ? { ...x, time } : x)) })} />
            </div>
          ))}
        </div>
      </PlanCard>

      <PlanCard icon={<Moon size={18} />} title="Seara" color="#9a8cff" on={value.sleep.on} onToggle={(on) => set({ sleep: { ...value.sleep, on } })}>
        <p className="plan-sentence">
          Vreau să mă culc până la <TimeField value={value.sleep.time} onChange={(time) => set({ sleep: { ...value.sleep, time } })} />
        </p>
      </PlanCard>

      <button type="button" className="plan-adv-toggle" onClick={() => setAdv(!adv)} aria-expanded={adv}>
        <ChevronDown size={15} style={{ transform: adv ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /> Avansat
      </button>
      {adv && (
        <div className="plan-adv">
          <div className="row wrap">
            <span className="small">Toleranță la ore</span>
            <div className="input-suffix" style={{ width: 110 }}>
              <input className="input num" type="number" min={0} max={120} value={value.tolerance} onChange={(e) => set({ tolerance: Math.max(0, Number(e.target.value) || 0) })} />
              <span>min</span>
            </div>
          </div>
          <p className="hint">
            Exemplu: cu 15 minute toleranță, trezirea la 07:12 pentru ținta 07:00 contează „la timp”. Punctele implicite: trezire 15, ajuns la program 15, terminat programul 5, fiecare masă 5,
            culcare 10. Le poți schimba ulterior din Sarcini.
          </p>
        </div>
      )}
    </div>
  );
}
