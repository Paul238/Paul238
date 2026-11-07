import { Check, Pencil, Plus, Sparkles, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { activeBonus, averageDailyCredits, isCompletedOn, previewReward, scheduleLabel, weekCount } from '../domain/engine';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { Burst } from '../ui/Art';
import { Bar } from '../ui/components';
import { fmt } from '../ui/format';
import { AttrBadge, AttrTag } from '../ui/icons';
import { BonusCard } from '../views/BonusCard';
import { GoalCard, GoalEditor } from '../views/GoalsView';

export function Sheet({ onClose, children, accent }: { onClose: () => void; children: ReactNode; accent?: string }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className={`sheet-overlay ${closing ? 'closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" style={accent ? { ['--sheet-accent' as string]: accent } : undefined}>
        <div className="sheet-handle" />
        <button className="sheet-close" onClick={close} aria-label="Închide">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ---------------- etapă (sarcină) ---------------- */

export function TaskSheet({ taskId, onClose, onEdit }: { taskId: string; onClose: () => void; onEdit: (t: Task) => void }) {
  const { state, api, today, now, notify } = useApp();
  const task = state.tasks.find((t) => t.id === taskId);
  const [burst, setBurst] = useState(false);
  const completion = state.completions.find((c) => c.taskId === taskId && c.date === today);
  const colors = useMemo(() => [...(task?.attributes ?? []).map((a) => ATTRIBUTE_MAP[a].color), '#ffd36b', '#ff7a59'], [task]);
  if (!task) return null;
  const reward = previewReward(state, task, now);
  const bonus = activeBonus(state, now);
  const isBonus = bonus?.taskId === task.id && bonus.revealed;
  const main = ATTRIBUTE_MAP[task.attributes[0] ?? 'discipline'];
  const done = !!completion;
  const week = task.schedule.kind === 'weekly' ? weekCount(state, task.id, today) : null;

  function complete() {
    setBurst(true);
    api.completeTask(task!.id);
    notify({ kind: isBonus ? 'bonus' : 'success', title: `+${reward.credits} credite`, body: isBonus ? 'Provocare cucerită!' : 'Încă o etapă urcată.' });
    setTimeout(onClose, 900);
  }

  return (
    <Sheet onClose={onClose} accent={main.color}>
      <div className="sheet-eyebrow">
        {isBonus ? (
          <span style={{ color: 'var(--gold)' }}>
            <Sparkles size={13} /> Provocare ×{bonus!.multiplier}
          </span>
        ) : (
          <span>Etapă · {scheduleLabel(task)}</span>
        )}
      </div>
      <h2 className="sheet-title">{task.title}</h2>
      <div className="row wrap" style={{ gap: 12 }}>
        {task.attributes.map((a) => (
          <AttrTag key={a} attr={a} />
        ))}
        {week !== null && task.schedule.kind === 'weekly' && (
          <span className="muted small">
            {week}/{task.schedule.times} săptămâna aceasta
          </span>
        )}
      </div>
      {task.notes && <p className="text-2 mt-12">{task.notes}</p>}

      <div className="sheet-reward">
        <div>
          <div className="eyebrow-label">Recompensă</div>
          <div className="sheet-credits num">+{done ? completion!.credits : reward.credits}</div>
          <div className="muted small">
            credite
            {!done && reward.streakMultiplier > 1 && ` · serie +${Math.round((reward.streakMultiplier - 1) * 100)}%`}
            {!done && reward.bonusMultiplier > 1 && ` · ×${reward.bonusMultiplier}`}
          </div>
        </div>
        <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
          {Object.entries(done ? completion!.xp : reward.xp).map(([k, v]) => (
            <span key={k} className="xp-chip" style={{ ['--c' as string]: ATTRIBUTE_MAP[k as AttributeKey].color }}>
              +{v} XP {ATTRIBUTE_MAP[k as AttributeKey].label}
            </span>
          ))}
        </div>
      </div>

      <div className="sheet-actions">
        {done ? (
          <button className="btn btn-block" style={{ height: 48 }} onClick={() => (api.undoCompletion(completion!.id), onClose())}>
            <Undo2 size={17} /> Anulează bifarea
          </button>
        ) : (
          <button className={`btn btn-block ${isBonus ? 'btn-gold' : 'btn-primary'} sheet-cta`} onClick={complete} disabled={burst}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Check size={20} strokeWidth={3} />
              {burst && <Burst colors={colors} />}
            </span>
            Am făcut-o
          </button>
        )}
        <button className="btn" style={{ height: 48 }} onClick={() => (onEdit(task), onClose())} aria-label="Editează">
          <Pencil size={16} />
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- vârf (obiectiv) ---------------- */

export function GoalSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { state, today } = useApp();
  const [editing, setEditing] = useState(false);
  const goal = state.goals.find((g) => g.id === goalId);
  useEffect(() => {
    if (!goal || (goal.status !== 'active' && goal.status !== 'reflecting')) onClose();
  }, [goal, onClose]);
  if (!goal) return null;
  return (
    <Sheet onClose={onClose} accent="#ffd36b">
      <div className="sheet-eyebrow">Vârf · obiectiv</div>
      <div className="sheet-goal">
        <GoalCard goal={goal} pace={averageDailyCredits(state, today)} onEdit={() => setEditing(true)} />
      </div>
      {editing && <GoalEditor goal={goal} defaultMode={goal.mode} onClose={() => setEditing(false)} />}
    </Sheet>
  );
}

/* ---------------- tabără (atribut) ---------------- */

export function CampSheet({
  attr,
  onClose,
  onAddTask,
  onOpenTask,
}: {
  attr: AttributeKey;
  onClose: () => void;
  onAddTask: () => void;
  onOpenTask: (id: string) => void;
}) {
  const { state, derived, today } = useApp();
  const a = ATTRIBUTE_MAP[attr];
  const l = derived.attributes[attr];
  const tasks = state.tasks.filter((t) => !t.archived && t.attributes.includes(attr));
  const count = (id: string) => state.completions.filter((c) => c.taskId === id).length;

  return (
    <Sheet onClose={onClose} accent={a.color}>
      <div className="sheet-eyebrow">Tabăra · atribut</div>
      <div className="row" style={{ gap: 16 }}>
        <AttrBadge attr={attr} size={54} />
        <div className="grow">
          <h2 className="sheet-title" style={{ margin: 0 }}>
            {a.label}
          </h2>
          <p className="muted small">{a.description}</p>
        </div>
        <div className="sheet-level num">{l.level}</div>
      </div>
      <div className="mt-16">
        <div className="row-between small">
          <span className="muted">Spre nivelul {l.level + 1}</span>
          <span className="num strong">
            {fmt(l.into)} / {fmt(l.needed)} XP
          </span>
        </div>
        <div className="mt-8">
          <Bar value={l.progress} color={a.color} size="lg" />
        </div>
      </div>

      <div className="eyebrow-label mt-24">Te antrenezi prin</div>
      <div className="sheet-list">
        {tasks.length === 0 && <p className="muted small">Nicio sarcină nu antrenează încă acest atribut.</p>}
        {tasks.map((t) => (
          <button key={t.id} className="sheet-list-item" onClick={() => onOpenTask(t.id)}>
            <span className={`dot-state ${isCompletedOn(state, t.id, today) ? 'on' : ''}`} style={{ ['--c' as string]: a.color }} />
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="strong">{t.title}</span>
              <span className="muted tiny" style={{ display: 'block' }}>
                {scheduleLabel(t)} · {count(t.id)} realizări{t.attributes[0] === attr ? ' · principal' : ' · 50% XP'}
              </span>
            </span>
            <span className="num" style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 17 }}>
              +{t.points}
            </span>
          </button>
        ))}
      </div>
      <button className="btn btn-block mt-16" style={{ height: 44 }} onClick={onAddTask}>
        <Plus size={16} /> Sarcină nouă pentru {a.label}
      </button>
    </Sheet>
  );
}

/* ---------------- provocarea dezvăluită ---------------- */

export function BonusSheet({ onClose }: { onClose: () => void }) {
  const { state, now } = useApp();
  const bonus = activeBonus(state, now) ?? state.bonuses[state.bonuses.length - 1];
  if (!bonus) return null;
  return (
    <Sheet onClose={onClose} accent="#ffd36b">
      <div className="sheet-eyebrow" style={{ color: 'var(--gold)' }}>
        <Sparkles size={13} /> Cometa a adus o provocare
      </div>
      <div className="reveal-anim">
        <BonusCard bonus={bonus} />
      </div>
      <p className="muted small mt-12">Etapa strălucește acum auriu pe traseu. O poți bifa de acolo sau de aici.</p>
    </Sheet>
  );
}
