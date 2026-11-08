import { ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { xpForTask } from '../domain/engine';
import { uid } from '../domain/id';
import type { AttributeKey, Schedule, Task, TaskKind, TimeMode } from '../domain/types';
import { useApp } from '../state/store';
import { AttributeChips, Modal, Switch } from '../ui/components';
import { SchedulePicker } from './SchedulePicker';

const PRESETS = [
  { label: 'Ușor', points: 5 },
  { label: 'Mediu', points: 15 },
  { label: 'Solicitant', points: 30 },
  { label: 'Dificil', points: 50 },
];

export function TaskEditor({
  task,
  onClose,
  defaultSpecial = false,
  defaultAttributes = [],
  defaultSchedule,
  initial,
}: {
  task?: Task;
  onClose: () => void;
  defaultSpecial?: boolean;
  defaultAttributes?: AttributeKey[];
  defaultSchedule?: Schedule;
  /** valori precompletate pentru o sarcină nouă (ex. din adăugarea rapidă) */
  initial?: Partial<Task>;
}) {
  const { api } = useApp();
  const [title, setTitle] = useState(task?.title ?? initial?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [points, setPoints] = useState(task?.points ?? initial?.points ?? 15);
  const [attributes, setAttributesRaw] = useState<AttributeKey[]>(task?.attributes ?? defaultAttributes);
  const [attrTouched, setAttrTouched] = useState(!!task || defaultAttributes.length > 0);
  const [suggested, setSuggested] = useState(false);
  const [more, setMore] = useState(!!task?.notes || !!task?.special);
  const setAttributes = (v: AttributeKey[]) => {
    setAttrTouched(true);
    setSuggested(false);
    setAttributesRaw(v);
  };
  const [schedule, setSchedule] = useState<Schedule>(task?.schedule ?? defaultSchedule ?? { kind: 'daily', days: [] });
  const special = task?.special ?? defaultSpecial;
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? initial?.kind ?? 'task');
  const [onRoad, setOnRoad] = useState<boolean | undefined>(task?.onRoad);
  const [time, setTime] = useState(task?.time ?? initial?.time ?? '');
  const [timeMode, setTimeMode] = useState<TimeMode>(task?.timeMode ?? 'by');
  const [tolerance, setTolerance] = useState(task?.tolerance ?? 10);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length > 0 && points > 0 && (kind === 'task' || /^\d{2}:\d{2}$/.test(time));
  const preview = xpForTask({ points, attributes } as Task, 1);

  function save() {
    if (!valid) return;
    api.saveTask({
      id: task?.id ?? uid('t'),
      kind,
      onRoad,
      time: time || undefined,
      timeMode: kind === 'time' ? timeMode : undefined,
      tolerance: kind === 'time' ? tolerance : undefined,
      title: title.trim(),
      notes: notes.trim() || undefined,
      points,
      attributes: attributes.length ? attributes : ['discipline'],
      schedule,
      special: kind === 'task' && special,
      archived: task?.archived ?? false,
      createdAt: task?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  }


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
        <input className="input" autoFocus value={title} onChange={(e) => {
            setTitle(e.target.value);
            if (!attrTouched) {
              const sug = suggestAttributes(e.target.value);
              setAttributesRaw(sug);
              setSuggested(sug.length > 0);
            }
          }} placeholder="ex. Citit 30 de minute" maxLength={80} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>

      <div className="field">
        <label>Tip de etapă</label>
        <div className="segmented full">
          <button type="button" className={kind === 'task' ? 'active' : ''} onClick={() => setKind('task')}>
            Sarcină
          </button>
          <button type="button" className={kind === 'time' ? 'active' : ''} onClick={() => (setKind('time'), setTime(time || '07:00'))}>
            Reper cu oră
          </button>
          <button type="button" className={kind === 'meal' ? 'active' : ''} onClick={() => (setKind('meal'), setTime(time || '13:00'), attributes.length === 0 && setAttributes(['health']))}>
            Masă
          </button>
        </div>
        <span className="hint">
          {kind === 'task'
            ? 'O activitate pe care o bifezi când o faci.'
            : kind === 'time'
              ? 'Notezi ora reală (ex. trezirea); primești punctele doar dacă te încadrezi.'
              : 'Notezi ce ai mâncat (calorii și macronutrienți); contează la scorul de nutriție.'}
        </span>
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <div className="field">
          <label>{kind === 'time' ? 'Ora țintă' : kind === 'meal' ? 'Ora mesei' : 'Ora aproximativă (opțional)'}</label>
          <input className="input num" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 130 }} />
        </div>
        {kind === 'time' && (
          <>
            <div className="field">
              <label>Regulă</label>
              <select className="select" value={timeMode} onChange={(e) => setTimeMode(e.target.value as TimeMode)} style={{ width: 170 }}>
                <option value="by">cel târziu la ora țintă</option>
                <option value="after">cel devreme la ora țintă</option>
                <option value="log">doar notez ora</option>
              </select>
            </div>
            {timeMode !== 'log' && (
              <div className="field">
                <label>Toleranță</label>
                <div className="input-suffix" style={{ width: 110 }}>
                  <input className="input num" type="number" min={0} value={tolerance} onChange={(e) => setTolerance(Math.max(0, Number(e.target.value) || 0))} />
                  <span>min</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="field">
        <label>Atribute dezvoltate</label>
        <AttributeChips value={attributes} onChange={setAttributes} />
        {suggested && <span className="hint">Sugerat după titlu — poți schimba.</span>}
        {attributes.length === 0 && <span className="hint">Opțional — dacă nu alegi, primește Disciplină.</span>}
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

      <div className="row-between" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="col">
          <span className="strong small">Activitate principală (pe drum)</span>
          <span className="muted tiny">Apare pe drumul cu omulețul. Celelalte apar doar în lista zilei.</span>
        </div>
        <Switch checked={onRoad ?? (kind === 'time' || kind === 'meal')} onChange={setOnRoad} label="Activitate principală" />
      </div>

      <div className="field">
        <label>Când?</label>
        <SchedulePicker value={schedule} onChange={setSchedule} />
      </div>

      <button type="button" className="plan-adv-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
        <ChevronDown size={15} style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /> Mai multe opțiuni
      </button>
      {more && (
        <>

      <div className="field">
        <label>Note (opțional)</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalii, criteriu de reușită…" />
      </div>

        </>
      )}

      <div className="row wrap small muted" style={{ gap: 14 }}>
        <span>
          Recompensă: <strong className="text-2">+{points} credite</strong>
        </span>
        {attributes.map((a) => (
          <span key={a}>
            +{preview[a]} XP {ATTRIBUTE_MAP[a].label}
          </span>
        ))}
      </div>
    </Modal>
  );
}

/** sugerează atribute din cuvintele titlului */
const KEYWORDS: [AttributeKey, RegExp][] = [
  ['health', /(sal[aă]|sport|alerg|antren|yoga|[iî]not|pa[sș]i|plimb|bicicl|somn|ap[aă]|fitness|stretch|vitamin|dentist|doctor|medic|analize|farmac|control)/i],
  ['intellect', /(citit|carte|curs|[iî]nv[aă][tț]|studi|limb[aă]|lec[tț]i|podcast|document)/i],
  ['creativity', /(desen|muzic|scris|chitar|pian|foto|creativ|pict|jurnal|compun)/i],
  ['discipline', /(medita|trezi|telefon|social media|f[aă]r[aă]|rutin|focus|concentr|du[sș] rece)/i],
  ['finance', /(buget|cheltu|econom|invest|bani|factur|economi)/i],
  ['social', /(prieten|famil|sun|mama|tata|[iî]nt[aâ]lnire|copii|partener|vizit)/i],
  ['order', /(cur[aă][tț]en|g[aă]tit|cas[aă]|vase|rufe|organiz|ordine|cump[aă]r[aă]turi)/i],
  ['career', /(proiect|munc|cv|certific|program|cod|client|raport|birou|carier)/i],
];

export function suggestAttributes(title: string): AttributeKey[] {
  return KEYWORDS.filter(([, re]) => re.test(title)).map(([k]) => k).slice(0, 2);
}
