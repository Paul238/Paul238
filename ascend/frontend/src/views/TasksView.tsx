import { Archive, CalendarDays, ArchiveRestore, Gift, Hourglass, ListChecks, Pencil, Plus, Star } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { BONUS_CHANCE, bonusEligibleTasks, isOnceDone, scheduleLabel } from '../domain/engine';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { fmt, fmtDate } from '../ui/format';
import { AttrTag } from '../ui/icons';
import { CalendarView } from './CalendarView';
import { TaskEditor } from './TaskEditor';

type Tab = 'calendar' | 'all' | 'special' | 'archive';

const FREQ_LABEL = { off: 'oprite', low: 'rar', normal: 'moderat', high: 'des', daily: 'zilnic' } as const;

export function TasksView() {
  const { state, api, now } = useApp();
  const [tab, setTab] = useState<Tab>('calendar');
  const [filter, setFilter] = useState<AttributeKey | 'all'>('all');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);

  const active = state.tasks.filter((t) => !t.archived);
  const special = active.filter((t) => t.special);
  const archived = state.tasks.filter((t) => t.archived);
  const list = (tab === 'all' ? active : tab === 'special' ? special : archived).filter(
    (t) => filter === 'all' || t.attributes.includes(filter),
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of state.completions) m.set(c.taskId, (m.get(c.taskId) ?? 0) + 1);
    return m;
  }, [state.completions]);

  const eligibleNow = bonusEligibleTasks(state, now).length;
  const history = [...state.bonuses].sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1)).slice(0, 12);
  const s = state.settings;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sarcini</h1>
          <p>Definește ce faci, cât valorează și ce atribute dezvoltă.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> Sarcină nouă
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          <CalendarDays size={15} /> Calendar
        </button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          <ListChecks size={15} /> Toate <span className="count">{active.length}</span>
        </button>
        <button className={`tab ${tab === 'special' ? 'active' : ''}`} onClick={() => setTab('special')}>
          <Star size={15} /> Lista specială <span className="count">{special.length}</span>
        </button>
        <button className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>
          <Archive size={15} /> Arhivă <span className="count">{archived.length}</span>
        </button>
      </div>

      {tab === 'special' && (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div className="bonus-seal" style={{ width: 40, height: 40, borderRadius: 10, animation: 'none' }}>
                <Gift size={20} />
              </div>
              <div className="col" style={{ gap: 6 }}>
                <h2>Cum funcționează provocările</h2>
                <p className="muted small">
                  Din când în când, la o oră aleatorie, aplicația alege o sarcină din această listă și ți-o dă ca provocare. Ai{' '}
                  <strong className="text-2">{s.bonusWindowHours} de ore</strong> să o realizezi, iar când o bifezi primești{' '}
                  <strong style={{ color: 'var(--gold)' }}>×{s.bonusMultiplier} puncte și XP</strong>. Adaugă aici doar sarcinile pe care le poți face
                  oricând.
                </p>
              </div>
            </div>
          </div>
          <div className="card col" style={{ gap: 8 }}>
            <span className="stat-label">Setări provocări</span>
            <div className="row-between small">
              <span className="muted">Frecvență</span>
              <span className="strong">
                {FREQ_LABEL[s.bonusFrequency]} {s.bonusFrequency !== 'off' && `(${Math.round(BONUS_CHANCE[s.bonusFrequency] * 100)}% / zi)`}
              </span>
            </div>
            <div className="row-between small">
              <span className="muted">Eligibile acum</span>
              <span className="strong">{eligibleNow}</span>
            </div>
            <div className="row-between small">
              <span className="muted">Finalizate</span>
              <span className="strong">{state.bonuses.filter((b) => b.status === 'completed').length}</span>
            </div>
            <span className="hint">Modifici din Setări.</span>
          </div>
        </div>
      )}

      {tab === 'calendar' && <CalendarView />}

      {tab !== 'calendar' && (
      <>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Toate atributele
        </button>
        {ATTRIBUTE_KEYS.map((k) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} style={{ ['--chip-color' as string]: ATTRIBUTE_MAP[k].color }} onClick={() => setFilter(k)}>
            <span className="dot" /> {ATTRIBUTE_MAP[k].label}
          </button>
        ))}
      </div>

      <div className="card card-flush">
        {list.length === 0 ? (
          <div className="empty">
            {tab === 'special' ? <Star size={34} /> : <ListChecks size={34} />}
            <div className="strong text-2">
              {tab === 'special' ? 'Lista specială e goală' : tab === 'archive' ? 'Nicio sarcină arhivată' : 'Nicio sarcină'}
            </div>
            <div className="small">
              {tab === 'special' ? 'Marchează cu stea sarcinile care pot deveni provocări.' : 'Creează prima sarcină pentru a începe.'}
            </div>
            {tab !== 'archive' && (
              <button className="btn btn-sm" onClick={() => setEditing('new')}>
                <Plus size={14} /> Sarcină nouă
              </button>
            )}
          </div>
        ) : (
          grouped(list, tab === 'all').map(({ t, header }) => (
            <Fragment key={t.id}>
            {header && <div className="section-label">{header}</div>}
            <div className="task-row">
              <button
                className="btn btn-ghost btn-icon"
                title={t.special ? 'Scoate din lista specială' : 'Adaugă în lista specială'}
                onClick={() => api.toggleSpecial(t.id)}
                style={{ color: t.special ? 'var(--gold)' : 'var(--muted)' }}
                disabled={t.archived}
              >
                <Star size={16} fill={t.special ? 'currentColor' : 'none'} />
              </button>
              <div className="grow">
                <div className="task-title truncate">{t.title}</div>
                <div className="task-meta">
                  {t.attributes.map((a) => (
                    <AttrTag key={a} attr={a} />
                  ))}
                  {t.kind === 'time' && <span className="badge">Reper · {t.time}</span>}
                  {t.kind === 'meal' && <span className="badge badge-success">Masă · {t.time}</span>}
                  {(t.kind ?? 'task') === 'task' && t.time && <span>~{t.time}</span>}
                  <span>{scheduleLabel(t)}</span>
                  <span>{fmt(counts.get(t.id) ?? 0)} realizări</span>
                  {isOnceDone(state, t) && <span className="badge badge-success">Finalizată</span>}
                </div>
              </div>
              <div className="task-points">
                {t.points}
                <small>{t.special ? `×${s.bonusMultiplier} = ${t.points * s.bonusMultiplier}` : 'puncte'}</small>
              </div>
              <button className="btn btn-ghost btn-icon" title="Editează" onClick={() => setEditing(t)}>
                <Pencil size={15} />
              </button>
              <button className="btn btn-ghost btn-icon" title={t.archived ? 'Restaurează' : 'Arhivează'} onClick={() => api.archiveTask(t.id, !t.archived)}>
                {t.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              </button>
            </div>
            </Fragment>
          ))
        )}
      </div>

      </>
      )}

      {tab === 'special' && history.length > 0 && (
        <div className="card card-flush mt-16">
          <div className="card-head" style={{ padding: '16px 16px 0', marginBottom: 8 }}>
            <h2>Istoric provocări</h2>
          </div>
          {history.map((b) => (
            <div key={b.id} className="list-item">
              <Hourglass size={15} className="muted" />
              <div className="grow">
                <div className="strong small">{b.revealed || b.status !== 'active' ? b.taskTitle : 'Provocare nedezvăluită'}</div>
                <div className="muted tiny">{fmtDate(b.assignedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <span className={`badge ${b.status === 'completed' ? 'badge-success' : b.status === 'active' ? 'badge-gold' : ''}`}>
                {b.status === 'completed' ? `Finalizată ×${b.multiplier}` : b.status === 'active' ? 'Activă' : 'Expirată'}
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && <TaskEditor task={editing === 'new' ? undefined : editing} defaultSpecial={tab === 'special'} onClose={() => setEditing(null)} />}
    </>
  );
}

const GROUPS: [string, (t: Task) => boolean][] = [
  ['Zilnic', (t) => t.schedule.kind === 'daily' && (t.schedule.days.length === 0 || t.schedule.days.length === 7)],
  ['În anumite zile', (t) => t.schedule.kind === 'daily'],
  ['De câteva ori pe săptămână, când vrei', (t) => t.schedule.kind === 'weekly'],
  ['Lunar', (t) => t.schedule.kind === 'monthly'],
  ['O singură dată, la o dată anume', (t) => t.schedule.kind === 'once' && !!t.schedule.due],
  ['Fără dată (până le faci)', () => true],
];

/** grupează sarcinile după felul în care se repetă, cu titluri de secțiune */
function grouped(list: Task[], withHeaders: boolean): { t: Task; header?: string }[] {
  if (!withHeaders) return list.map((t) => ({ t }));
  const out: { t: Task; header?: string }[] = [];
  const left = [...list];
  for (const [name, test] of GROUPS) {
    const inGroup = left.filter(test).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
    inGroup.forEach((t, i) => out.push({ t, header: i === 0 ? `${name} · ${inGroup.length}` : undefined }));
    for (const t of inGroup) left.splice(left.indexOf(t), 1);
  }
  return out;
}
