import { Check, CalendarPlus, Plus, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { isCompletedOn, isScheduledOn, scheduleLabel } from '../domain/engine';
import { uid } from '../domain/id';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { StageGlyph } from '../ui/stage';
import { suggestAttributes } from './TaskEditor';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SIZES = [
  { label: 'Ușor', points: 5 },
  { label: 'Mediu', points: 15 },
  { label: 'Solicitant', points: 30 },
];

/**
 * Căutare de activități.
 * - mode „log”: bifează ce ai făcut azi (chiar dacă nu era programat) și primești punctele;
 * - mode „plan”: adaugă activitatea în ziua `date` (pe lângă ce vine automat).
 */
export function ActivitySearch({ mode, date, onOpen, autoFocus, suggest = true }: { mode: 'log' | 'plan'; date: string; onOpen?: (t: Task) => void; autoFocus?: boolean; suggest?: boolean }) {
  const { state, api, notify } = useApp();
  const [q, setQ] = useState('');
  const [newPts, setNewPts] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of state.completions) m.set(c.taskId, (m.get(c.taskId) ?? 0) + 1);
    return m;
  }, [state.completions]);

  const tasks = state.tasks.filter((t) => !t.archived);
  const nq = norm(q);
  const results = nq
    ? tasks.filter((t) => norm(t.title).includes(nq)).slice(0, 6)
    : [...tasks].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, mode === 'log' && suggest ? 5 : 0);
  const exact = tasks.some((t) => norm(t.title) === nq);

  const status = (t: Task) => {
    if (isCompletedOn(state, t.id, date)) return 'done';
    if (t.skip?.includes(date)) return 'skipped';
    if (isScheduledOn(t, date) && t.schedule.kind !== 'weekly') return 'planned';
    return 'free';
  };

  function pick(t: Task) {
    const st = status(t);
    if (mode === 'log') {
      if (st === 'done') return;
      if (t.kind === 'time' || t.kind === 'meal') {
        onOpen?.(t);
        return;
      }
      const cid = api.completeTask(t.id);
      notify({ kind: 'success', title: `+${t.points} credite`, body: `${t.title} · în rucsac`, action: { label: 'Anulează', run: () => api.undoCompletion(cid) } });
    } else {
      if (st === 'planned' || st === 'done') return;
      if (st === 'skipped') api.skipDate(t.id, date, false);
      else api.extraDate(t.id, date, true);
      notify({ kind: 'info', title: 'Adăugat în plan', body: t.title });
    }
    setQ('');
    input.current?.blur();
  }

  function create(points: number) {
    const title = q.trim();
    if (!title) return;
    const attrs = suggestAttributes(title);
    const task: Task = {
      id: uid('t'),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      points,
      attributes: attrs.length ? attrs : ['discipline'],
      schedule: { kind: 'once', due: date },
      special: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    api.saveTask(task);
    if (mode === 'log') {
      const cid = api.completeTask(task.id);
      notify({ kind: 'success', title: `+${points} credite`, body: `${task.title} · activitate nouă`, action: { label: 'Anulează', run: () => api.undoCompletion(cid) } });
    } else notify({ kind: 'info', title: 'Adăugat în plan', body: task.title });
    setQ('');
    setNewPts(null);
  }

  return (
    <div className="asearch">
      <div className="asearch-input">
        <Search size={16} />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setNewPts(null);
          }}
          placeholder={mode === 'log' ? 'Ce ai mai făcut? (ex. sală, citit…)' : 'Adaugă o activitate în ziua asta…'}
          autoFocus={autoFocus}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && pick(results[0])}
          aria-label={mode === 'log' ? 'Caută o activitate făcută azi' : 'Caută o activitate de planificat'}
        />
        {q && (
          <button className="asearch-clear" onClick={() => setQ('')} aria-label="Șterge căutarea">
            <X size={14} />
          </button>
        )}
      </div>

      {(results.length > 0 || nq) && (
        <div className="asearch-results">
          {!nq && mode === 'log' && <span className="eyebrow-label">Cele mai frecvente</span>}
          {results.map((t) => {
            const st = status(t);
            const disabled = mode === 'log' ? st === 'done' : st === 'planned' || st === 'done';
            return (
              <button key={t.id} className={`asearch-row ${disabled ? 'off' : ''}`} onClick={() => pick(t)} disabled={disabled} style={{ ['--c' as string]: ATTRIBUTE_MAP[t.attributes[0] ?? 'discipline'].color }}>
                <span className="asearch-icon">
                  <StageGlyph task={t} size={15} />
                </span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <b>{t.title}</b>
                  <small>
                    {scheduleLabel(t)}
                    {st === 'planned' && mode === 'plan' && ' · deja în plan'}
                    {st === 'skipped' && ' · sărită — atinge ca s-o readuci'}
                  </small>
                </span>
                <span className="asearch-action">
                  {disabled ? (
                    <>
                      <Check size={14} /> {st === 'done' ? 'făcut' : 'în plan'}
                    </>
                  ) : mode === 'log' ? (
                    <>+{t.points}</>
                  ) : (
                    <>
                      <CalendarPlus size={14} /> adaugă
                    </>
                  )}
                </span>
              </button>
            );
          })}
          {nq && !exact && (
            <div className="asearch-new">
              <span className="grow">
                <Plus size={14} /> Activitate nouă: <b>„{q.trim()}”</b>
              </span>
              {newPts === null ? (
                <div className="row" style={{ gap: 4 }}>
                  {SIZES.map((s) => (
                    <button key={s.label} className="chip" onClick={() => create(s.points)} title={`${s.label} · ${s.points} puncte`}>
                      {s.label} +{s.points}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
