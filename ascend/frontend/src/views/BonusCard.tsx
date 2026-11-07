import { CircleCheck, Gift, Hourglass, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isCompletedOn, previewReward } from '../domain/engine';
import type { BonusChallenge } from '../domain/types';
import { useApp } from '../state/store';
import { Bar } from '../ui/components';
import { duration } from '../ui/format';

function useSecondClock() {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function BonusCard({ bonus }: { bonus: BonusChallenge }) {
  const { state, api, today, notify } = useApp();
  const clock = useSecondClock();
  const task = state.tasks.find((t) => t.id === bonus.taskId);
  const remaining = Date.parse(bonus.expiresAt) - clock;
  const total = Date.parse(bonus.expiresAt) - Date.parse(bonus.assignedAt);
  const reward = task && bonus.status === 'active' ? previewReward(state, task, new Date(clock).toISOString()).credits : 0;

  if (bonus.status === 'completed') {
    return (
      <div className="bonus-card row gap-16">
        <div className="bonus-seal" style={{ animation: 'none', background: 'var(--success-soft)', color: 'var(--success)' }}>
          <CircleCheck size={24} />
        </div>
        <div className="grow">
          <div className="eyebrow" style={{ color: 'var(--success)' }}>Provocare finalizată</div>
          <h3>{bonus.taskTitle}</h3>
          <p className="muted small">Ai primit punctele ×{bonus.multiplier}. Următoarea provocare apare aleatoriu.</p>
        </div>
      </div>
    );
  }

  if (!bonus.revealed) {
    return (
      <div className="bonus-card">
        <div className="bonus-sealed">
          <div className="bonus-seal">
            <Gift size={26} />
          </div>
          <div className="grow">
            <div className="eyebrow">
              <Sparkles size={13} /> Provocare surpriză
            </div>
            <h3>O sarcină din lista ta specială te așteaptă</h3>
            <p className="muted small">Odată dezvăluită, ai la dispoziție timpul rămas pentru a o finaliza cu puncte ×{bonus.multiplier}.</p>
          </div>
          <button className="btn btn-gold" onClick={() => api.revealBonus(bonus.id)}>
            Dezvăluie
          </button>
        </div>
      </div>
    );
  }

  const doneNormally = task && isCompletedOn(state, task.id, today);

  return (
    <div className="bonus-card reveal-anim">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="eyebrow">
            <Sparkles size={13} /> Provocare activă
          </div>
          <h3>{bonus.taskTitle}</h3>
          <p className="muted small mt-8">
            Recompensă: <strong style={{ color: 'var(--gold)' }}>+{reward} credite</strong> și XP ×{bonus.multiplier}
          </p>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <span className="multiplier">×{bonus.multiplier}</span>
        </div>
      </div>
      <div className="mt-16 row gap-16 wrap">
        <div className="grow" style={{ minWidth: 200 }}>
          <div className="row-between small">
            <span className="muted row" style={{ gap: 6 }}>
              <Hourglass size={13} /> Timp rămas
            </span>
            <span className="countdown" style={{ fontSize: 15 }}>{duration(remaining)}</span>
          </div>
          <div className="mt-8">
            <Bar value={remaining / total} color="var(--gold)" />
          </div>
        </div>
        {task ? (
          <button
            className="btn btn-gold"
            disabled={!!doneNormally}
            title={doneNormally ? 'Ai bifat deja sarcina azi; o poți finaliza ca provocare mâine, în timpul rămas.' : undefined}
            onClick={() => {
              api.completeTask(task.id);
              notify({ kind: 'bonus', title: `+${Math.round(reward)} credite`, body: 'Provocare finalizată.' });
            }}
          >
            <CircleCheck size={16} /> Marchează realizată
          </button>
        ) : (
          <span className="muted small">Sarcina a fost ștearsă.</span>
        )}
      </div>
    </div>
  );
}
