import { CalendarDays, CalendarRange, Repeat, Shuffle, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { WEEKDAY_SHORT, WEEK_ORDER, dateKey } from '../domain/dates';
import type { Schedule } from '../domain/types';

type Mode = 'every' | 'days' | 'weekly' | 'monthly' | 'once';

const FULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function modeOf(s: Schedule): Mode {
  if (s.kind === 'daily') return s.days.length === 0 ? 'every' : 'days';
  return s.kind;
}

function joinRo(parts: string[]) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} și ${parts[parts.length - 1]}`;
}

/** rezumatul programării, în cuvinte */
export function scheduleSentence(s: Schedule): string {
  switch (s.kind) {
    case 'daily':
      return s.days.length === 0 || s.days.length === 7 ? 'Apare în fiecare zi.' : `Apare ${joinRo(WEEK_ORDER.filter((d) => s.days.includes(d)).map((d) => FULL[d]))}.`;
    case 'weekly':
      return `De ${s.times} ${s.times === 1 ? 'dată' : 'ori'} pe săptămână, în ce zile vrei. Apare pe drum până atingi numărul.`;
    case 'monthly':
      return `Apare în fiecare lună, pe ${s.day}${s.day > 28 ? ' (sau în ultima zi, dacă luna e mai scurtă)' : ''}.`;
    case 'once':
      return s.due
        ? `Apare o singură dată, pe ${new Date(s.due + 'T12:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}. Dacă n-o faci atunci, rămâne ca restanță.`
        : 'Apare în fiecare zi până o faci, apoi dispare.';
  }
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateKey(d);
};

export function SchedulePicker({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const mode = modeOf(value);
  const opts: { m: Mode; icon: ReactNode; label: string; make: () => Schedule }[] = [
    { m: 'every', icon: <Sun size={16} />, label: 'Zilnic', make: () => ({ kind: 'daily', days: [] }) },
    { m: 'days', icon: <CalendarRange size={16} />, label: 'În anumite zile', make: () => ({ kind: 'daily', days: [1, 3, 5] }) },
    { m: 'weekly', icon: <Shuffle size={16} />, label: 'De N ori / săpt.', make: () => ({ kind: 'weekly', times: 3 }) },
    { m: 'monthly', icon: <Repeat size={16} />, label: 'Lunar', make: () => ({ kind: 'monthly', day: new Date().getDate() }) },
    { m: 'once', icon: <CalendarDays size={16} />, label: 'O singură dată', make: () => ({ kind: 'once', due: tomorrow() }) },
  ];

  const days = value.kind === 'daily' ? value.days : [];
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (next.length === 0) return;
    onChange({ kind: 'daily', days: next.length === 7 ? [] : next });
  };

  return (
    <div className="sched">
      <div className="sched-modes" role="radiogroup" aria-label="Când apare sarcina">
        {opts.map((o) => (
          <button key={o.m} type="button" role="radio" aria-checked={mode === o.m} className={`sched-mode ${mode === o.m ? 'on' : ''}`} onClick={() => mode !== o.m && onChange(o.make())}>
            {o.icon}
            <span>{o.label}</span>
          </button>
        ))}
      </div>

      {mode === 'days' && (
        <div className="sched-detail">
          <div className="weekday-picker">
            {WEEK_ORDER.map((d) => (
              <button key={d} type="button" className={days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)} aria-pressed={days.includes(d)}>
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {(
              [
                ['L–V', [1, 2, 3, 4, 5]],
                ['Weekend', [6, 0]],
                ['L · Mi · V', [1, 3, 5]],
                ['Ma · J', [2, 4]],
              ] as [string, number[]][]
            ).map(([l, d]) => (
              <button key={l} type="button" className="chip" onClick={() => onChange({ kind: 'daily', days: d })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.kind === 'weekly' && (
        <div className="sched-detail row wrap">
          <span className="muted">De</span>
          <div className="segmented">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" className={value.times === n ? 'active' : ''} onClick={() => onChange({ kind: 'weekly', times: n })}>
                {n}
              </button>
            ))}
          </div>
          <span className="muted">ori pe săptămână</span>
        </div>
      )}

      {value.kind === 'monthly' && (
        <div className="sched-detail row wrap">
          <span className="muted">În ziua</span>
          <input className="input num" type="number" min={1} max={31} value={value.day} onChange={(e) => onChange({ kind: 'monthly', day: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} style={{ width: 80 }} />
          <span className="muted">a fiecărei luni</span>
        </div>
      )}

      {value.kind === 'once' && (
        <div className="sched-detail row wrap">
          <input className="input" type="date" value={value.due ?? ''} onChange={(e) => onChange({ kind: 'once', due: e.target.value || undefined })} style={{ width: 180 }} />
          <button type="button" className="chip" onClick={() => onChange({ kind: 'once', due: dateKey(new Date()) })}>
            Azi
          </button>
          <button type="button" className="chip" onClick={() => onChange({ kind: 'once', due: tomorrow() })}>
            Mâine
          </button>
          <button type="button" className={`chip ${!value.due ? 'on' : ''}`} onClick={() => onChange({ kind: 'once' })}>
            Fără dată
          </button>
        </div>
      )}

      <p className="sched-sentence">{scheduleSentence(value)}</p>
    </div>
  );
}
