import { Check, ListPlus, Moon, Utensils, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { creditsOn, previewReward, tasksForDay, type TodayItem } from '../domain/engine';
import { dayTotals, targetsFor, toMinutes } from '../domain/nutrition';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { Burst } from '../ui/Art';
import { fmt, longToday } from '../ui/format';
import { StageGlyph, stageStatus } from '../ui/stage';
import { ItemSheet, NutritionSheet, RecapSheet } from '../world/Sheets';
import { ActivitySearch } from './ActivitySearch';
import { QuickAdd } from './QuickAdd';
import { TaskEditor } from './TaskEditor';

const PARTS: { label: string; until: number }[] = [
  { label: 'Dimineața', until: 11 * 60 },
  { label: 'La prânz', until: 15 * 60 },
  { label: 'După-amiaza', until: 18 * 60 },
  { label: 'Seara', until: 24 * 60 },
];

function partOf(t: Task) {
  if (!t.time) return 'Oricând azi';
  const m = toMinutes(t.time);
  return PARTS.find((p) => m < p.until)!.label;
}

/** ecranul „Azi”: tot ce e programat azi, în ordinea zilei */
export function TodayList({ onPlanTomorrow }: { onPlanTomorrow: () => void }) {
  const { state, api, today, now, notify } = useApp();
  const [sheet, setSheet] = useState<{ kind: 'item'; id: string } | { kind: 'nutrition' } | { kind: 'recap' } | null>(null);
  const [edit, setEdit] = useState<Task | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => tasksForDay(state, today, { today }), [state, today]);
  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const groups = useMemo(() => {
    const order = [...PARTS.map((p) => p.label), 'Oricând azi'];
    const sorted = [...items].sort((a, b) => (a.task.time ?? '99').localeCompare(b.task.time ?? '99'));
    return order.map((g) => ({ g, list: sorted.filter((i) => partOf(i.task) === g) })).filter((x) => x.list.length);
  }, [items]);
  const doneN = items.filter((i) => i.completion).length;
  const profile = state.settings.nutrition;
  const totals = dayTotals(state, today);

  function check(it: TodayItem) {
    if (it.completion) return api.undoCompletion(it.completion.id);
    if ((it.task.kind ?? 'task') !== 'task') return setSheet({ kind: 'item', id: it.task.id });
    const reward = previewReward(state, it.task, new Date().toISOString()).credits;
    const cid = api.completeTask(it.task.id);
    setBurst(it.task.id);
    setTimeout(() => setBurst(null), 900);
    notify({ kind: 'success', title: `+${reward} credite`, body: it.task.title, action: { label: 'Anulează', run: () => api.undoCompletion(cid) } });
  }

  return (
    <div className="today">
      <div className="page-head">
        <div>
          <h1>Azi</h1>
          <p>
            {longToday(d)} · {doneN} din {items.length} făcute · +{fmt(creditsOn(state, today))} credite
          </p>
        </div>
        <div className="row">
        <button className="btn" onClick={() => setAdding(!adding)}>
          <ListPlus size={15} /> Adaugă în program
        </button>
        <button className="btn" onClick={() => setSheet({ kind: 'recap' })}>
          <Moon size={15} /> Încheie ziua
        </button>
        </div>
      </div>

      <div className="today-progress" aria-hidden="true">
        <span style={{ width: `${items.length ? (doneN / items.length) * 100 : 0}%` }} />
      </div>

      {adding && (
        <div className="card mb-12">
          <QuickAdd autoFocus />
        </div>
      )}

      <ActivitySearch mode="log" date={today} onOpen={(t) => setSheet({ kind: 'item', id: t.id })} suggest={false} />


      {groups.length === 0 && (
        <div className="card empty mt-16">
          <div className="strong text-2">Nimic programat azi</div>
          <div className="small">Caută mai sus ce ai făcut sau planifică din Plan.</div>
        </div>
      )}

      {groups.map(({ g, list }) => (
        <section key={g} className="today-group">
          <h3 className="eyebrow-label">{g}</h3>
          <div className="today-items">
            {list.map((it) => {
              const st = stageStatus(it, nowMin);
              const a = ATTRIBUTE_MAP[it.task.attributes[0] ?? 'discipline'];
              return (
                <div key={it.task.id} className={`trow ${st}`} style={{ ['--c' as string]: a.color }}>
                  <button className={`tcheck ${it.completion ? 'on' : ''}`} onClick={() => check(it)} aria-label={it.completion ? `Anulează ${it.task.title}` : `Bifează ${it.task.title}`}>
                    {st === 'missed' ? <X size={16} strokeWidth={3} /> : it.completion ? <Check size={16} strokeWidth={3} /> : <StageGlyph task={it.task} size={16} />}
                    {burst === it.task.id && <Burst colors={[a.color, '#ffd36b', '#ff7a59']} />}
                  </button>
                  <button className="tmain" onClick={() => setSheet({ kind: 'item', id: it.task.id })}>
                    <b>{it.task.title}</b>
                    <small>
                      {it.task.time ? `${it.task.time}` : 'oricând'}
                      {it.task.kind === 'time' && !it.completion ? ' · notezi ora' : ''}
                      {it.task.kind === 'meal' && !it.completion ? ' · notezi ce ai mâncat' : ''}
                      {it.completion?.value ? ` · notat ${it.completion.value}` : ''}
                      {st === 'late' ? (it.overdue ? ' · restanță' : ' · întârziat') : ''}
                      {it.weekProgress ? ` · ${it.weekProgress.done}/${it.weekProgress.target} săptămâna asta` : ''}
                    </small>
                  </button>
                  <span className="tpts num">+{it.completion?.credits ?? previewReward(state, it.task, now).credits}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {(profile || totals.kcal > 0) && (
        <button className="today-nutri" onClick={() => setSheet({ kind: 'nutrition' })}>
          <Utensils size={16} />
          <span className="grow">
            <b>Nutriția zilei</b>
            <small>
              {fmt(totals.kcal)}
              {profile ? ` / ${fmt(targetsFor(profile).kcal)}` : ''} kcal · P {Math.round(totals.protein)} g · C {Math.round(totals.carbs)} g · G {Math.round(totals.fat)} g
            </small>
          </span>
        </button>
      )}

      {sheet?.kind === 'item' && <ItemSheet id={sheet.id} onClose={() => setSheet(null)} onEdit={(t) => setEdit(t)} />}
      {sheet?.kind === 'nutrition' && <NutritionSheet onClose={() => setSheet(null)} onSetup={() => setSheet(null)} />}
      {sheet?.kind === 'recap' && <RecapSheet onClose={() => setSheet(null)} onNutrition={() => setSheet({ kind: 'nutrition' })} onPlanTomorrow={() => (setSheet(null), onPlanTomorrow())} />}
      {edit && <TaskEditor task={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
