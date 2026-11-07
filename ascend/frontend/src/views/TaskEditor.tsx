import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { WEEKDAY_SHORT, WEEK_ORDER } from '../domain/dates';
import { xpForTask } from '../domain/engine';
import { uid } from '../domain/id';
import type { AttributeKey, Schedule, Task } from '../domain/types';
import { useApp } from '../state/store';
import { AttributeChips, Modal, Switch } from '../ui/components';

const PRESETS = [
  { label: 'Ușor', points: 5 },
  { label: 'Mediu', points: 15 },
  { label: 'Solicitant', points: 30 },
  { label: 'Dificil', points: 50 },
];

export function TaskEditor({ task, onClose, defaultSpecial = false }: { task?: Task; onClose: () => void; defaultSpecial?: boolean }) {
  const { api, state } = useApp();
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [points, setPoints] = useState(task?.points ?? 15);
  const [attributes, setAttributes] = useState<AttributeKey[]>(task?.attributes ?? []);
  const [schedule, setSchedule] = useState<Schedule>(task?.schedule ?? { kind: 'daily', days: [] });
  const [special, setSpecial] = useState(task?.special ?? defaultSpecial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length > 0 && attributes.length > 0 && points > 0;
  const preview = xpForTask({ points, attributes } as Task, 1);
  const mult = state.settings.bonusMultiplier;

  function save() {
    if (!valid) return;
    api.saveTask({
      id: task?.id ?? uid('t'),
      title: title.trim(),
      notes: notes.trim() || undefined,
      points,
      attributes,
      schedule,
      special,
      archived: task?.archived ?? false,
      createdAt: task?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  }

  const daily = schedule.kind === 'daily' ? schedule : null;

  return (
    <Modal
      title={task ? 'Editează sarcina' : 'Sarcină nouă'}
      onClose={onClose}
      footer={
        <>
          {task && (
            <button className="btn btn-ghost btn-danger" style={{ marginRight: 'auto' }} onClick={() => (confirmDelete ? (api.deleteTask(task.id), onClose()) : setConfirmDelete(true))}>
              <Trash2 size={15} /> {confirmDelete ? 'Confirmă ștergerea' : 'Șterge'}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!valid}>
            Salvează
          </button>
        </>
      }
    >
      <div className="field">
        <label>Titlu</label>
        <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Citit 30 de minute" maxLength={80} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>

      <div className="field">
        <label>Atribute dezvoltate</label>
        <AttributeChips value={attributes} onChange={setAttributes} />
        <span className="hint">Primul atribut ales primește 100% XP, celelalte 50%. Maxim 3.</span>
      </div>

      <div className="field">
        <label>Puncte</label>
        <div className="row wrap">
          <div className="segmented">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className={points === p.points ? 'active' : ''} onClick={() => setPoints(p.points)}>
                {p.label} · {p.points}
              </button>
            ))}
          </div>
          <div className="input-suffix" style={{ width: 110 }}>
            <input className="input num" type="number" min={1} max={1000} value={points} onChange={(e) => setPoints(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
            <span>pct</span>
          </div>
        </div>
      </div>

      <div className="field">
        <label>Frecvență</label>
        <div className="segmented full">
          <button type="button" className={schedule.kind === 'daily' ? 'active' : ''} onClick={() => setSchedule({ kind: 'daily', days: [] })}>
            Zile fixe
          </button>
          <button type="button" className={schedule.kind === 'weekly' ? 'active' : ''} onClick={() => setSchedule({ kind: 'weekly', times: 3 })}>
            De N ori / săptămână
          </button>
          <button type="button" className={schedule.kind === 'once' ? 'active' : ''} onClick={() => setSchedule({ kind: 'once' })}>
            O singură dată
          </button>
        </div>
        {daily && (
          <div className="col mt-8">
            <div className="weekday-picker">
              {WEEK_ORDER.map((d) => {
                const on = daily.days.length === 0 || daily.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={on ? 'on' : ''}
                    onClick={() => {
                      const base = daily.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : daily.days;
                      const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
                      if (next.length === 0) return;
                      setSchedule({ kind: 'daily', days: next.length === 7 ? [] : next });
                    }}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
            <span className="hint">{daily.days.length === 0 ? 'În fiecare zi.' : 'Doar în zilele selectate.'}</span>
          </div>
        )}
        {schedule.kind === 'weekly' && (
          <div className="row mt-8">
            <input className="input num" type="number" min={1} max={7} value={schedule.times} onChange={(e) => setSchedule({ kind: 'weekly', times: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} style={{ width: 80 }} />
            <span className="muted">ori pe săptămână, în orice zi (maxim o dată pe zi)</span>
          </div>
        )}
        {schedule.kind === 'once' && (
          <div className="row mt-8">
            <span className="muted">Termen (opțional)</span>
            <input className="input" type="date" value={schedule.due ?? ''} onChange={(e) => setSchedule({ kind: 'once', due: e.target.value || undefined })} style={{ width: 180 }} />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
        <div className="row-between">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Star size={16} style={{ color: 'var(--gold)', marginTop: 2 }} fill={special ? 'currentColor' : 'none'} />
            <div className="col">
              <span className="strong">Lista specială</span>
              <span className="muted small">
                Poate fi aleasă aleatoriu ca provocare: ai 24h să o faci și primești ×{mult} puncte. Bifează doar dacă o poți face oricând.
              </span>
            </div>
          </div>
          <Switch checked={special} onChange={setSpecial} label="Lista specială" />
        </div>
      </div>

      <div className="field">
        <label>Note (opțional)</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalii, criteriu de reușită…" />
      </div>

      <div className="row wrap small muted" style={{ gap: 14 }}>
        <span>
          Recompensă: <strong className="text-2">+{points} credite</strong>
        </span>
        {attributes.map((a) => (
          <span key={a}>
            +{preview[a]} XP {ATTRIBUTE_MAP[a].label}
          </span>
        ))}
        {special && <span style={{ color: 'var(--gold)' }}>Ca provocare: +{points * mult} credite</span>}
      </div>
    </Modal>
  );
}
