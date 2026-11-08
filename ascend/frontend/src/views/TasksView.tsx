import { Archive, ArchiveRestore, ListChecks, Pencil } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { attributeDef, visibleAttributeKeys } from '../domain/attributes';
import { isOnceDone, scheduleLabel } from '../domain/engine';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { fmt } from '../ui/format';
import { AttrTag } from '../ui/icons';
import { StageGlyph } from '../ui/stage';
import { QuickAdd } from './QuickAdd';
import { TaskEditor } from './TaskEditor';

type Tab = 'active' | 'archive';

/** biblioteca de activități: adaugi rapid, vezi programul fiecăreia, editezi sau arhivezi */
export function TasksView(_: { embedded?: boolean } = {}) {
  const { state, api } = useApp();
  const [tab, setTab] = useState<Tab>('active');
  const [filter, setFilter] = useState<AttributeKey | 'all'>('all');
  const [editing, setEditing] = useState<Task | null>(null);

  const active = state.tasks.filter((t) => !t.archived);
  const archived = state.tasks.filter((t) => t.archived);
  const list = (tab === 'active' ? active : archived).filter((t) => filter === 'all' || t.attributes.includes(filter));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of state.completions) m.set(c.taskId, (m.get(c.taskId) ?? 0) + 1);
    return m;
  }, [state.completions]);

  return (
    <>
      <div className="card">
        <QuickAdd />
      </div>

      <div className="tabs mt-16">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          <ListChecks size={15} /> În program <span className="count">{active.length}</span>
        </button>
        <button className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>
          <Archive size={15} /> Arhivă <span className="count">{archived.length}</span>
        </button>
      </div>

      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Toate laturile
        </button>
        {visibleAttributeKeys().map((k) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} style={{ ['--chip-color' as string]: attributeDef(k).color }} onClick={() => setFilter(k)}>
            <span className="dot" /> {attributeDef(k).label}
          </button>
        ))}
      </div>

      <div className="card card-flush">
        {list.length === 0 ? (
          <div className="empty">
            <ListChecks size={34} />
            <div className="strong text-2">{tab === 'archive' ? 'Nicio activitate arhivată' : 'Nicio activitate'}</div>
            {tab === 'active' && <div className="small">Scrie mai sus, de exemplu „Sală luni miercuri vineri 18:00”.</div>}
          </div>
        ) : (
          grouped(list, tab === 'active').map(({ t, header }) => (
            <Fragment key={t.id}>
              {header && <div className="section-label">{header}</div>}
              <div className="task-row">
                <span className="asearch-icon" style={{ ['--c' as string]: attributeDef(t.attributes[0] ?? 'discipline').color }}>
                  <StageGlyph task={t} size={15} />
                </span>
                <button className="grow lib-main" onClick={() => setEditing(t)}>
                  <div className="task-title truncate">{t.title}</div>
                  <div className="task-meta">
                    <span className="strong text-2">
                      {scheduleLabel(t)}
                      {t.time ? ` · ${t.time}` : ''}
                    </span>
                    {t.kind === 'time' && <span className="badge">reper cu oră</span>}
                    {t.kind === 'meal' && <span className="badge badge-success">masă</span>}
                    {t.attributes.map((a) => (
                      <AttrTag key={a} attr={a} />
                    ))}
                    <span>{fmt(counts.get(t.id) ?? 0)}× făcută</span>
                    {isOnceDone(state, t) && <span className="badge badge-success">Finalizată</span>}
                  </div>
                </button>
                <div className="task-points">
                  +{t.points}
                  <small>credite</small>
                </div>
                <button className="btn btn-ghost btn-icon" title="Editează" onClick={() => setEditing(t)}>
                  <Pencil size={15} />
                </button>
                <button className="btn btn-ghost btn-icon" title={t.archived ? 'Readu în program' : 'Arhivează'} onClick={() => api.archiveTask(t.id, !t.archived)}>
                  {t.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                </button>
              </div>
            </Fragment>
          ))
        )}
      </div>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
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
