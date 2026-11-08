import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { addDays, dateKey, parseKey, weekStart } from '../domain/dates';
import { calendarDay, weekCount, type PlanStatus, type TodayItem } from '../domain/engine';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { StageGlyph } from '../ui/stage';
import { PlanDay } from './PlanDay';
import { TaskEditor } from './TaskEditor';

type Mode = 'week' | 'month';
const WD = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

function dayTitle(k: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const s = parseKey(k).toLocaleDateString('ro-RO', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarView() {
  const { state, today } = useApp();
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ task?: Task } | null>(null);

  const days = useMemo(() => {
    if (mode === 'week') {
      const start = weekStart(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = anchor.slice(0, 8) + '01';
    const start = weekStart(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [mode, anchor]);

  const plan = useMemo(() => Object.fromEntries(days.map((d) => [d, calendarDay(state, d, today)])), [days, state, today]);
  const flexible = state.tasks.filter((t) => !t.archived && t.schedule.kind === 'weekly');
  const backlog = state.tasks.filter((t) => !t.archived && t.schedule.kind === 'once' && !t.schedule.due && !state.completions.some((c) => c.taskId === t.id));

  const move = (dir: number) => {
    if (mode === 'week') setAnchor(addDays(anchor, dir * 7));
    else {
      const d = parseKey(anchor);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      setAnchor(dateKey(d));
    }
  };

  const title =
    mode === 'week'
      ? `${parseKey(days[0]).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – ${parseKey(days[6]).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : dayTitle(anchor, { month: 'long', year: 'numeric' });

  const month = anchor.slice(0, 7);

  return (
    <div className="cal">
      <div className="cal-bar">
        <div className="row">
          <button className="btn btn-icon" onClick={() => move(-1)} aria-label="Înapoi">
            <ChevronLeft size={18} />
          </button>
          <button className="btn btn-sm" onClick={() => (setAnchor(today), setSelected(null))}>
            Azi
          </button>
          <button className="btn btn-icon" onClick={() => move(1)} aria-label="Înainte">
            <ChevronRight size={18} />
          </button>
          <h2 className="display cal-title">{title}</h2>
        </div>
        <div className="segmented">
          <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>
            Săptămână
          </button>
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
            Lună
          </button>
        </div>
      </div>

      {mode === 'week' && flexible.length > 0 && (
        <div className="cal-flex">
          <span className="eyebrow-label">Flexibile săptămâna aceasta</span>
          {flexible.map((t) => {
            const n = weekCount(state, t.id, days[0]);
            const target = t.schedule.kind === 'weekly' ? t.schedule.times : 1;
            return (
              <button key={t.id} className={`cal-flex-chip ${n >= target ? 'done' : ''}`} onClick={() => setEditor({ task: t })} style={{ ['--c' as string]: ATTRIBUTE_MAP[t.attributes[0] ?? 'discipline'].color }}>
                <StageGlyph task={t} size={13} />
                {t.title}
                <b className="num">
                  {n}/{target}
                </b>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'week' ? (
        <div className="cal-week">
          {days.map((d, i) => (
            <div key={d} className={`cal-col ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}`}>
              <button className={`cal-col-head ${selected === d ? 'sel' : ''}`} onClick={() => setSelected(selected === d ? null : d)} aria-label={`Planul pentru ${dayTitle(d)}`}>
                <span>{WD[i]}</span>
                <b className="num">{Number(d.slice(8))}</b>
              </button>
              <div className="cal-col-body">
                {plan[d].map(({ item, status }) => (
                  <PlanChip key={item.task.id} item={item} status={status} onClick={() => setEditor({ task: item.task })} />
                ))}
                {plan[d].length === 0 && <span className="cal-free">liber</span>}
              </div>
              {d >= today && (
                <button className="cal-add" onClick={() => setSelected(d)} aria-label={`Adaugă sarcină pe ${dayTitle(d)}`}>
                  <Plus size={14} /> Adaugă
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cal-month">
          {WD.map((w) => (
            <span key={w} className="cal-wd">
              {w}
            </span>
          ))}
          {days.map((d) => {
            const items = plan[d];
            const counted = items.filter((x) => x.status !== 'skipped');
            const done = counted.filter((x) => x.status === 'done').length;
            return (
              <button key={d} className={`cal-cell ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today ? 'today' : ''} ${selected === d ? 'sel' : ''}`} onClick={() => setSelected(d)}>
                <span className="cal-cell-n num">{Number(d.slice(8))}</span>
                <span className="cal-cell-items">
                  {items.filter((x) => x.status !== 'skipped').slice(0, 3).map(({ item, status }) => (
                    <span key={item.task.id} className={`cal-mini ${status}`} style={{ ['--c' as string]: ATTRIBUTE_MAP[item.task.attributes[0] ?? 'discipline'].color }}>
                      {item.task.title}
                    </span>
                  ))}
                  {counted.length > 3 && <span className="cal-more">+{counted.length - 3}</span>}
                </span>
                {d < today && counted.length > 0 && <span className={`cal-score ${done === counted.length ? 'full' : ''}`}>{done}/{counted.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="card cal-day">
          <div className="row-between">
            <h3 className="display" style={{ fontSize: 20 }}>
              {dayTitle(selected)}
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)} aria-label="Închide ziua">
              <X size={16} />
            </button>
          </div>
          <PlanDay date={selected} compact />
        </div>
      )}

      {backlog.length > 0 && (
        <div className="cal-backlog">
          <span className="eyebrow-label">Fără dată · apar zilnic până le faci</span>
          <div className="row wrap mt-8" style={{ gap: 6 }}>
            {backlog.map((t) => (
              <button key={t.id} className="chip" onClick={() => setEditor({ task: t })}>
                <StageGlyph task={t} size={13} /> {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {editor && <TaskEditor task={editor.task} onClose={() => setEditor(null)} />}
    </div>
  );
}

function PlanChip({ item, status, onClick, wide }: { item: TodayItem; status: PlanStatus; onClick: () => void; wide?: boolean }) {
  const t = item.task;
  return (
    <button className={`plan-chip ${status} ${wide ? 'wide' : ''}`} onClick={onClick} style={{ ['--c' as string]: ATTRIBUTE_MAP[t.attributes[0] ?? 'discipline'].color }} title={t.title}>
      <span className="plan-chip-icon">
        {status === 'done' ? <Check size={12} strokeWidth={3} /> : status === 'missed' ? <X size={12} strokeWidth={3} /> : <StageGlyph task={t} size={12} />}
      </span>
      <span className="plan-chip-text">
        <b>{t.title}</b>
        <small>
          {t.time ?? ''}
          {item.completion?.value ? ` · ${item.completion.value}` : ''} · +{item.completion?.credits ?? t.points}
        </small>
      </span>
    </button>
  );
}
