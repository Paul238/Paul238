import { Check, Coins, Flame, Mountain, Plus, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { keyOf } from '../domain/dates';
import {
  activeBonus,
  averageDailyCredits,
  creditsOn,
  goalRequiredCredits,
  previewReward,
  scheduleLabel,
  streakMultiplierFor,
  tasksForDay,
  type TodayItem,
} from '../domain/engine';
import { characterTitle } from '../domain/leveling';
import type { AttributeKey, BonusChallenge } from '../domain/types';
import { useApp } from '../state/store';
import { Burst, Constellation, Summit } from '../ui/Art';
import { Bar } from '../ui/components';
import { fmt, greeting, lei, longToday, plural } from '../ui/format';
import { AttrTag } from '../ui/icons';
import { Landscape, periodLabel } from '../ui/Landscape';
import { BonusCard } from './BonusCard';
import type { View } from './Layout';
import { TaskEditor } from './TaskEditor';

function heroLine(done: number, total: number) {
  if (total === 0) return 'Niciun traseu programat azi. Adaugă o etapă și pornește la drum.';
  if (done === 0) return `Traseul de azi are ${total} ${plural(total, 'etapă', 'etape')}. Primul pas e cel mai greu.`;
  if (done < total) return `${done} din ${total} etape urcate. Mai ai ${total - done} până pe vârf.`;
  return 'Ai atins vârful zilei. Coborî mândru: munca de azi contează.';
}

export function TodayView({ go }: { go: (v: View) => void }) {
  const { state, today, now, derived } = useApp();
  const [editing, setEditing] = useState(false);
  const items = useMemo(() => tasksForDay(state, today), [state, today]);
  const todo = items.filter((i) => i.status === 'todo');
  const done = items.filter((i) => i.status === 'done');
  const earnedToday = creditsOn(state, today);
  const bonus = activeBonus(state, now);
  const todaysBonus: BonusChallenge | undefined =
    bonus ?? state.bonuses.find((b) => b.status === 'completed' && !!b.completedAt && keyOf(b.completedAt) === today);

  // multiplicatorul aplicat azi se bazează pe seria de până ieri
  const streakMult = streakMultiplierFor(derived.streak.activeToday ? derived.streak.days - 1 : derived.streak.days, state.settings.streakBonus);
  const firstName = state.character?.name.split(' ')[0] ?? '';
  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;

  const levels = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, derived.attributes[k].level])) as Record<AttributeKey, number>;
  const progress = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, derived.attributes[k].progress])) as Record<AttributeKey, number>;

  return (
    <>
      <section className="hero">
        <Landscape hour={hour} total={items.length} done={done.length} height={360}>
          <div className="hero-top">
            <div className="hero-eyebrow">
              {longToday(d)} · {periodLabel(hour)}
            </div>
            <h1 className="hero-title">
              {greeting(d)}, <em>{firstName}</em>.
            </h1>
            <p className="hero-sub">{heroLine(done.length, items.length)}</p>
          </div>
        </Landscape>
        <div className="hero-chips">
          <button className="hero-chip" onClick={() => go('character')} title="1 XP = 1 metru urcat">
            <Mountain size={15} />
            <span>
              <b className="num">{fmt(derived.level.total)} m</b>
              <small>altitudine totală</small>
            </span>
          </button>
          <button className="hero-chip hero-chip-level" onClick={() => go('character')}>
            <span className="hero-level">{derived.level.level}</span>
            <span style={{ minWidth: 110 }}>
              <b>{characterTitle(derived.level.level)}</b>
              <span className="hero-bar">
                <span style={{ width: `${derived.level.progress * 100}%` }} />
              </span>
            </span>
          </button>
          <div className="hero-chip">
            <Flame size={15} className={derived.streak.activeToday ? 'flame-on' : undefined} />
            <span>
              <b className="num">
                {derived.streak.days} {plural(derived.streak.days, 'zi', 'zile')}
              </b>
              <small>{state.settings.streakBonus ? `serie · +${Math.round((streakMult - 1) * 100)}% credite` : 'serie'}</small>
            </span>
          </div>
          <button className="hero-chip" onClick={() => go('goals')}>
            <Coins size={15} />
            <span>
              <b className="num">{fmt(derived.available)}</b>
              <small>credite · {lei(derived.available * state.settings.leiPerCredit)}</small>
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-main mt-24">
        <div className="col" style={{ gap: 20 }}>
          {todaysBonus && <BonusCard bonus={todaysBonus} />}

          <section className="card trail-card">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <div>
                <div className="eyebrow-label">Traseul de azi</div>
                <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>
                  {items.length === 0 ? 'Drum liber' : `${done.length} / ${items.length} etape`}
                </h2>
              </div>
              <div className="row">
                <span className="muted small num">+{fmt(earnedToday)} credite azi</span>
                <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                  <Plus size={15} /> Etapă
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="empty">
                <Mountain size={38} />
                <div className="strong text-2">Nicio etapă programată azi</div>
                <div className="small">Adaugă o sarcină sau ajustează programul celor existente.</div>
              </div>
            ) : (
              <ol className="trail">
                {todo.map((i, idx) => (
                  <TaskRow key={i.task.id} item={i} step={done.length + idx + 1} bonusTaskId={bonus?.revealed ? bonus.taskId : undefined} />
                ))}
                {done.length > 0 && <li className="trail-divider">Etape urcate</li>}
                {done.map((i, idx) => (
                  <TaskRow key={i.task.id} item={i} step={idx + 1} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="col" style={{ gap: 20 }}>
          <NextSummit go={go} />
          <section className="card cst-card" onClick={() => go('character')}>
            <div className="row-between">
              <div>
                <div className="eyebrow-label">Constelația ta</div>
                <h2 className="display" style={{ fontSize: 20, marginTop: 4 }}>
                  8 atribute
                </h2>
              </div>
              <span className="muted small">Detalii →</span>
            </div>
            <Constellation levels={levels} progress={progress} name={state.character!.name} color={state.character!.color} level={derived.level.level} />
          </section>
        </div>
      </div>

      {editing && <TaskEditor onClose={() => setEditing(false)} />}
    </>
  );
}

function TaskRow({ item, step, bonusTaskId }: { item: TodayItem; step: number; bonusTaskId?: string }) {
  const { state, api } = useApp();
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const { task, completion, weekProgress } = item;
  const done = !!completion;
  const isBonus = bonusTaskId === task.id;
  const reward = done ? null : previewReward(state, task, new Date().toISOString());
  const colors = useMemo(() => [...task.attributes.map((a) => ATTRIBUTE_MAP[a].color), '#ffd36b', '#ff7a59'], [task.attributes]);
  const main = ATTRIBUTE_MAP[task.attributes[0] ?? 'discipline'];

  function toggle() {
    if (done) {
      api.undoCompletion(completion!.id);
      return;
    }
    setCelebrate(reward?.credits ?? task.points);
    api.completeTask(task.id);
    setTimeout(() => setCelebrate(null), 1200);
  }

  return (
    <li className={`trail-step ${done ? 'done' : ''} ${isBonus ? 'bonus' : ''}`} style={{ ['--c' as string]: main.color }}>
      <button className={`trail-node ${done ? 'on' : ''}`} onClick={toggle} aria-label={done ? 'Anulează' : 'Marchează realizată'} title={done ? 'Anulează' : 'Marchează realizată'}>
        {done ? <Check size={15} strokeWidth={3} /> : <span className="num">{step}</span>}
        {celebrate !== null && <Burst colors={colors} />}
      </button>
      <div className="trail-body">
        <div className="trail-title">{task.title}</div>
        <div className="task-meta">
          {task.attributes.map((a) => (
            <AttrTag key={a} attr={a} />
          ))}
          <span>{weekProgress ? `${weekProgress.done}/${weekProgress.target} săptămâna aceasta` : scheduleLabel(task)}</span>
          {isBonus && <span className="badge badge-gold">Provocare ×{state.settings.bonusMultiplier}</span>}
          {completion && completion.bonusMultiplier > 1 && <span className="badge badge-gold">×{completion.bonusMultiplier}</span>}
        </div>
      </div>
      {celebrate !== null && <span className="float-gain">+{celebrate}</span>}
      <div className="trail-reward">
        <b className="num">+{done ? completion!.credits : reward!.credits}</b>
        <small>credite</small>
      </div>
      {done && (
        <button className="btn btn-ghost btn-icon trail-undo" onClick={toggle} title="Anulează">
          <Undo2 size={15} />
        </button>
      )}
    </li>
  );
}

function NextSummit({ go }: { go: (v: View) => void }) {
  const { state, today, derived } = useApp();
  const goals = state.goals.filter((g) => g.status === 'active' || g.status === 'reflecting');
  const goal = [...goals].sort((a, b) => b.saved / goalRequiredCredits(b, state.settings) - a.saved / goalRequiredCredits(a, state.settings))[0];
  const pace = averageDailyCredits(state, today);

  if (!goal) {
    return (
      <section className="card summit-card" onClick={() => go('goals')}>
        <div className="eyebrow-label">Vârful următor</div>
        <Summit progress={0} funded={false} />
        <p className="muted small">Alege un vârf: un laptop, un curs, o vacanță. Creditele de azi te duc spre el.</p>
        <button className="btn btn-sm mt-12">
          <Plus size={14} /> Obiectiv nou
        </button>
      </section>
    );
  }
  const required = goalRequiredCredits(goal, state.settings);
  const missing = Math.max(0, required - goal.saved);
  const canCover = Math.min(missing, derived.available);
  const days = pace > 0 ? Math.ceil((missing - canCover) / pace) : null;
  const pct = goal.saved / required;

  return (
    <section className="card summit-card" onClick={() => go('goals')}>
      <div className="row-between">
        <div className="eyebrow-label">Vârful următor</div>
        {goal.status === 'reflecting' && <span className="badge badge-warning">În reflecție</span>}
      </div>
      <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>
        {goal.title}
      </h2>
      <Summit progress={pct} funded={missing === 0} variant={goal.title.length} />
      <div className="row-between small">
        <span className="muted num">
          {fmt(goal.saved)} / {fmt(required)} credite
        </span>
        <span className="display num" style={{ fontSize: 18 }}>
          {Math.floor(pct * 100)}%
        </span>
      </div>
      <div className="mt-8">
        <Bar value={pct} color="var(--gold)" />
      </div>
      <p className="muted small mt-12">
        {missing === 0
          ? 'Ai ajuns pe vârf. Finalizează achiziția din Obiective.'
          : days === null
            ? 'Bifează etape ca să estimez când ajungi.'
            : canCover > 0
              ? `Ai ${fmt(canCover)} credite de alocat acum · apoi ~${days} zile`
              : `~${days} zile până pe vârf, la ritmul tău de ${fmt(pace)} credite/zi`}
      </p>
    </section>
  );
}
