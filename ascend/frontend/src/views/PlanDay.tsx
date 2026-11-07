import { Check, Pencil, Plus, Repeat, RotateCcw, SkipForward, X } from 'lucide-react';
import { useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { parseKey } from '../domain/dates';
import { calendarDay, scheduleLabel } from '../domain/engine';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { fmt } from '../ui/format';
import { StageGlyph } from '../world/Journey';
import { TaskEditor } from './TaskEditor';

export function dayName(k: string) {
  const s = parseKey(k).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** planul unei zile: ce vine automat, excepții (sari peste) și sarcini doar pentru ziua asta */
export function PlanDay({ date, compact }: { date: string; compact?: boolean }) {
  const { state, api, today } = useApp();
  const [editor, setEditor] = useState<{ task?: Task; once?: boolean; recurring?: boolean } | null>(null);
  const rows = calendarDay(state, date, today);
  const active = rows.filter((r) => r.status !== 'skipped');
  const possible = active.reduce((s, r) => s + (r.item.completion?.credits ?? r.item.task.points), 0);
  const future = date >= today;
  const rel = date === today ? 'azi' : date > today ? 'în ziua asta' : '';

  return (
    <div className="planday">
      {!compact && <h3 className="display planday-title">{dayName(date)}</h3>}
      <p className="muted small">
        {active.length} {active.length === 1 ? 'etapă' : 'etape'} · până la +{fmt(possible)} credite
      </p>

      <div className="planday-list">
        {rows.length === 0 && <p className="muted small">Nimic programat. O zi liberă sau adaugă ceva mai jos.</p>}
        {rows.map(({ item, status }) => {
          const t = item.task;
          const recurring = t.schedule.kind !== 'once';
          return (
            <div key={t.id} className={`planday-row ${status}`} style={{ ['--c' as string]: ATTRIBUTE_MAP[t.attributes[0] ?? 'discipline'].color }}>
              <span className="planday-time num">{t.time ?? '—'}</span>
              <span className="planday-icon">
                {status === 'done' ? <Check size={14} strokeWidth={3} /> : status === 'missed' ? <X size={14} strokeWidth={3} /> : <StageGlyph task={t} size={15} />}
              </span>
              <span className="grow">
                <b>{t.title}</b>
                <small>
                  {recurring ? (
                    <>
                      <Repeat size={11} style={{ verticalAlign: -1 }} /> {scheduleLabel(t)}
                    </>
                  ) : (
                    'doar în ziua asta'
                  )}
                  {status === 'skipped' && ' · sărită'}
                  {item.completion?.value ? ` · notat ${item.completion.value}` : ''}
                </small>
              </span>
              <span className="planday-pts num">+{item.completion?.credits ?? t.points}</span>
              {future && recurring && status === 'planned' && (
                <button className="btn btn-sm btn-ghost" onClick={() => api.skipDate(t.id, date, true)} title={`Nu apare ${rel}; regula rămâne`}>
                  <SkipForward size={14} /> Sari peste
                </button>
              )}
              {status === 'skipped' && (
                <button className="btn btn-sm" onClick={() => api.skipDate(t.id, date, false)}>
                  <RotateCcw size={14} /> Readu
                </button>
              )}
              <button className="btn btn-ghost btn-icon" onClick={() => setEditor({ task: t })} aria-label={`Editează ${t.title}`}>
                <Pencil size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {future && (
        <div className="row wrap mt-12" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setEditor({ once: true })}>
            <Plus size={15} /> Doar pentru {date === today ? 'azi' : 'ziua asta'}
          </button>
          <button className="btn" onClick={() => setEditor({ recurring: true })}>
            <Repeat size={15} /> Sarcină care se repetă
          </button>
        </div>
      )}

      {editor && (
        <TaskEditor
          task={editor.task}
          defaultSchedule={editor.once ? { kind: 'once', due: date } : editor.recurring ? { kind: 'daily', days: [parseKey(date).getDay()] } : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
