import { CalendarCheck, Check, Coins, Flame, Plus, Sparkles, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
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
import { keyOf } from '../domain/dates';
import { characterTitle } from '../domain/leveling';
import type { BonusChallenge } from '../domain/types';
import { useApp } from '../state/store';
import { Bar, Ring } from '../ui/components';
import { fmt, greeting, lei, longToday, plural } from '../ui/format';
import { AttrBadge, AttrTag } from '../ui/icons';
import { BonusCard } from './BonusCard';
import { TaskEditor } from './TaskEditor';
import type { View } from './Layout';

export function TodayView({ go }: { go: (v: View) => void }) {
  const { state, today, now, derived } = useApp();
  const [editing, setEditing] = useState(false);
  const items = useMemo(() => tasksForDay(state, today), [state, today]);
  const todo = items.filter((i) => i.status === 'todo');
  const done = items.filter((i) => i.status === 'done');
  const earnedToday = creditsOn(state, today);
  const possible = items.reduce((s, i) => s + (i.completion ? i.completion.credits : i.task.points), 0);
  const bonus = activeBonus(state, now);
  const todaysBonus: BonusChallenge | undefined =
    bonus ?? state.bonuses.find((b) => b.status === 'completed' && !!b.completedAt && keyOf(b.completedAt) === today);

  // multiplicatorul aplicat azi se bazează pe seria de până ieri
  const nextMult = streakMultiplierFor(derived.streak.activeToday ? derived.streak.days - 1 : derived.streak.days, state.settings.streakBonus);
  const firstName = state.character?.name.split(' ')[0] ?? '';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p>{longToday()}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          <Plus size={16} /> Sarcină nouă
        </button>
      </div>

      <div className="grid grid-4">
        <div className="card stat row" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Ring value={possible ? earnedToday / possible : 0} size={58} color="var(--success)">
            <strong style={{ fontSize: 13 }}>{possible ? Math.round((earnedToday / possible) * 100) : 0}%</strong>
          </Ring>
          <div className="col" style={{ gap: 2 }}>
            <span className="stat-label">Progres azi</span>
            <span className="stat-value" style={{ fontSize: 20 }}>
              {done.length}/{items.length}
            </span>
            <span className="stat-sub">{fmt(earnedToday)} credite câștigate</span>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <Flame size={14} style={{ color: 'var(--warning)' }} /> Serie
          </span>
          <span className="stat-value">
            {derived.streak.days} <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{plural(derived.streak.days, 'zi', 'zile')}</span>
          </span>
          <span className="stat-sub">
            {state.settings.streakBonus ? `Bonus serie: +${Math.round((nextMult - 1) * 100)}% credite` : 'Bonusul de serie e oprit'}
            {!derived.streak.activeToday && derived.streak.days > 0 && <span style={{ color: 'var(--warning)' }}> · bifează ceva azi</span>}
          </span>
        </div>
        <div className="card stat" style={{ cursor: 'pointer' }} onClick={() => go('goals')}>
          <span className="stat-label">
            <Coins size={14} style={{ color: 'var(--gold)' }} /> Credite disponibile
          </span>
          <span className="stat-value">{fmt(derived.available)}</span>
          <span className="stat-sub">≈ {lei(derived.available * state.settings.leiPerCredit)}</span>
        </div>
        <div className="card stat" style={{ cursor: 'pointer' }} onClick={() => go('character')}>
          <span className="stat-label">
            <Sparkles size={14} style={{ color: 'var(--accent-2)' }} /> Nivel {derived.level.level} · {characterTitle(derived.level.level)}
          </span>
          <span className="stat-value">
            {fmt(derived.level.into)} <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>/ {fmt(derived.level.needed)} XP</span>
          </span>
          <Bar value={derived.level.progress} />
        </div>
      </div>

      <div className="grid grid-main mt-16">
        <div className="col" style={{ gap: 16 }}>
          {todaysBonus && <BonusCard bonus={todaysBonus} />}

          <div className="card card-flush">
            <div className="card-head" style={{ padding: '16px 16px 0', marginBottom: 12 }}>
              <h2>Sarcinile de azi</h2>
              <span className="muted small">
                {fmt(earnedToday)} / {fmt(possible)} credite
              </span>
            </div>
            {items.length === 0 ? (
              <div className="empty">
                <CalendarCheck size={36} />
                <div>
                  <div className="strong text-2">Nicio sarcină programată azi</div>
                  <div className="small">Adaugă o sarcină sau ajustează programul celor existente.</div>
                </div>
                <button className="btn btn-sm" onClick={() => setEditing(true)}>
                  <Plus size={14} /> Adaugă
                </button>
              </div>
            ) : (
              <div className="task-list">
                {todo.length > 0 && <div className="section-label">De făcut · {todo.length}</div>}
                {todo.map((i) => (
                  <TaskRow key={i.task.id} item={i} bonusTaskId={bonus?.revealed ? bonus.taskId : undefined} />
                ))}
                {done.length > 0 && <div className="section-label">Realizate · {done.length}</div>}
                {done.map((i) => (
                  <TaskRow key={i.task.id} item={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <MainGoalCard go={go} />
          <div className="card">
            <div className="card-head">
              <h2>Atribute</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => go('character')}>
                Detalii
              </button>
            </div>
            {ATTRIBUTE_KEYS.map((k) => {
              const l = derived.attributes[k];
              return (
                <div key={k} className="attr-row">
                  <AttrBadge attr={k} />
                  <div className="col" style={{ gap: 5 }}>
                    <span className="small strong">{ATTRIBUTE_MAP[k].label}</span>
                    <Bar value={l.progress} color={ATTRIBUTE_MAP[k].color} size="thin" />
                  </div>
                  <span className="level-pill num">{l.level}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editing && <TaskEditor onClose={() => setEditing(false)} />}
    </>
  );
}

function TaskRow({ item, bonusTaskId }: { item: TodayItem; bonusTaskId?: string }) {
  const { state, api } = useApp();
  const [gain, setGain] = useState<number | null>(null);
  const { task, completion, weekProgress } = item;
  const done = !!completion;
  const isBonus = bonusTaskId === task.id;
  const reward = done ? null : previewReward(state, task, new Date().toISOString());

  function toggle() {
    if (done) {
      api.undoCompletion(completion!.id);
      return;
    }
    setGain(reward?.credits ?? task.points);
    api.completeTask(task.id);
    setTimeout(() => setGain(null), 1100);
  }

  return (
    <div className={`task-row ${done ? 'done' : ''} ${isBonus ? 'bonus' : ''}`}>
      <button className={`check ${done ? 'on' : ''}`} onClick={toggle} aria-label={done ? 'Anulează' : 'Marchează realizată'} title={done ? 'Anulează' : 'Marchează realizată'}>
        <Check size={15} strokeWidth={3} />
      </button>
      <div className="grow">
        <div className="task-title truncate">{task.title}</div>
        <div className="task-meta">
          {task.attributes.map((a) => (
            <AttrTag key={a} attr={a} />
          ))}
          <span>{weekProgress ? `${weekProgress.done}/${weekProgress.target} săptămâna aceasta` : scheduleLabel(task)}</span>
          {isBonus && <span className="badge badge-gold">Provocare ×{state.settings.bonusMultiplier}</span>}
          {completion && completion.bonusMultiplier > 1 && <span className="badge badge-gold">×{completion.bonusMultiplier}</span>}
        </div>
      </div>
      {gain !== null && <span className="float-gain">+{gain}</span>}
      <div className="task-points">
        {done ? `+${completion!.credits}` : `+${reward!.credits}`}
        <small>credite</small>
      </div>
      {done && (
        <button className="btn btn-ghost btn-icon" onClick={toggle} title="Anulează">
          <Undo2 size={15} />
        </button>
      )}
    </div>
  );
}

function MainGoalCard({ go }: { go: (v: View) => void }) {
  const { state, today, derived } = useApp();
  const goals = state.goals.filter((g) => g.status === 'active' || g.status === 'reflecting');
  const goal = [...goals].sort((a, b) => b.saved / goalRequiredCredits(b, state.settings) - a.saved / goalRequiredCredits(a, state.settings))[0];
  const pace = averageDailyCredits(state, today);
  if (!goal) {
    return (
      <div className="card">
        <h2>Obiective</h2>
        <p className="muted small mt-8">Setează un obiectiv (un laptop, un curs, o vacanță) și transformă creditele în ceva concret.</p>
        <button className="btn btn-sm mt-12" onClick={() => go('goals')}>
          <Plus size={14} /> Obiectiv nou
        </button>
      </div>
    );
  }
  const required = goalRequiredCredits(goal, state.settings);
  const missing = Math.max(0, required - goal.saved);
  const canCover = Math.min(missing, derived.available);
  const days = pace > 0 ? Math.ceil((missing - canCover) / pace) : null;
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={() => go('goals')}>
      <div className="card-head">
        <h2>Obiectiv principal</h2>
        {goal.status === 'reflecting' && <span className="badge badge-warning">În reflecție</span>}
      </div>
      <div className="strong">{goal.title}</div>
      <div className="row-between small mt-8">
        <span className="muted">
          {fmt(goal.saved)} / {fmt(required)} credite
        </span>
        <span className="strong num">{Math.floor((goal.saved / required) * 100)}%</span>
      </div>
      <div className="mt-8">
        <Bar value={goal.saved / required} color="var(--gold)" size="lg" />
      </div>
      <p className="muted small mt-12">
        {missing === 0
          ? 'Obiectiv finanțat complet.'
          : days === null
            ? 'Bifează sarcini pentru a estima termenul.'
            : canCover > 0
              ? `Ai ${fmt(canCover)} credite disponibile de alocat · încă ~${days} zile`
              : `~${days} zile la ritmul actual (${fmt(pace)} credite/zi)`}
      </p>
    </div>
  );
}
