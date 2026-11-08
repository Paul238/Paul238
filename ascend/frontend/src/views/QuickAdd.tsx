import { Clock, CornerDownLeft, Repeat, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { scheduleLabel } from '../domain/engine';
import { uid } from '../domain/id';
import { parseQuick } from '../domain/quickadd';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { suggestAttributes } from './TaskEditor';
import { TaskEditor } from './TaskEditor';

/** un singur rând: „Sală luni miercuri vineri 18:00 30p” → activitate programată */
export function QuickAdd({ autoFocus }: { autoFocus?: boolean }) {
  const { api, today, notify } = useApp();
  const [text, setText] = useState('');
  const [details, setDetails] = useState<Task | null>(null);
  const p = useMemo(() => (text.trim() ? parseQuick(text, today) : null), [text, today]);

  function build(): Task | null {
    if (!p || !p.title) return null;
    const attrs = suggestAttributes(p.title);
    return {
      id: uid('t'),
      title: p.title,
      kind: p.kind,
      time: p.time,
      timeMode: p.kind === 'time' ? 'by' : undefined,
      tolerance: p.kind === 'time' ? 10 : undefined,
      points: p.points ?? (p.kind === 'meal' ? 5 : 15),
      attributes: attrs.length ? attrs : p.kind === 'meal' ? ['health'] : ['discipline'],
      schedule: p.schedule,
      special: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };
  }

  function save() {
    const t = build();
    if (!t) return;
    api.saveTask(t);
    notify({ kind: 'success', title: `Adăugat: ${t.title}`, body: `${scheduleLabel(t)}${t.time ? ` · ${t.time}` : ''} · +${t.points} credite`, action: { label: 'Anulează', run: () => api.deleteTask(t.id) } });
    setText('');
  }

  return (
    <div className="qadd">
      <div className="qadd-input">
        <Sparkles size={16} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Adaugă în program… ex: Sală luni miercuri vineri 18:00 30p"
          autoFocus={autoFocus}
          aria-label="Adaugă o activitate în program"
        />
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!p?.title}>
          <CornerDownLeft size={14} /> Adaugă
        </button>
      </div>
      {p && p.title && (
        <div className="qadd-preview">
          <b>{p.title}</b>
          <span className="qchip">
            <Repeat size={12} /> {p.recognized.filter((r) => !r.startsWith('ora') && !r.endsWith('puncte')).join(' · ') || 'zilnic'}
          </span>
          {p.time && (
            <span className="qchip">
              <Clock size={12} /> {p.time}
            </span>
          )}
          <span className="qchip gold">+{p.points ?? (p.kind === 'meal' ? 5 : 15)}</span>
          {p.kind !== 'task' && <span className="qchip">{p.kind === 'meal' ? 'masă' : 'reper cu oră'}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setDetails(build())}>
            <SlidersHorizontal size={13} /> Detalii
          </button>
        </div>
      )}
      {!p && <p className="qadd-hint">Scrie natural: „Dentist mâine 15:30”, „Plată chirie lunar pe 5”, „Alergare de 2 ori pe săptămână”, „Citit zilnic 20p”.</p>}
      {details && (
        <TaskEditor
          task={undefined}
          defaultSchedule={details.schedule}
          defaultAttributes={details.attributes}
          initial={details}
          onClose={() => {
            setDetails(null);
            setText('');
          }}
        />
      )}
    </div>
  );
}
