import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { DEFAULT_SETTINGS, scheduleLabel } from '../domain/engine';
import { uid } from '../domain/id';
import { DEFAULT_NUTRITION, computedTargets } from '../domain/nutrition';
import { AVATAR_COLORS, TASK_TEMPLATES } from '../domain/templates';
import type { Goal, NutritionProfile, Task } from '../domain/types';
import { useApp } from '../state/store';
import { fmt, lei } from '../ui/format';
import { AttrIcon } from '../ui/icons';
import { DEFAULT_PLAN, DayPlanForm, planToTasks, type DayPlan } from '../world/DayPlan';
import { ProfileAvatar } from '../ui/components';
import { NutritionForm } from '../world/RoutineSetup';

const STEPS = ['Tu', 'Ziua ta', 'Obiceiuri', 'Nutriție', 'Primul obiectiv'];
const GOAL_IDEAS: [string, number][] = [
  ['Laptop', 6000],
  ['Telefon nou', 3500],
  ['Vacanță', 4000],
  ['Curs online', 800],
  ['Bicicletă', 2500],
];

export function OnboardingView() {
  const { session, api } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(session.name);
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [plan, setPlan] = useState<DayPlan>(DEFAULT_PLAN);
  const [habits, setHabits] = useState<Set<number>>(() => new Set([0, 4, 15]));
  const [nutri, setNutri] = useState<NutritionProfile | null>(DEFAULT_NUTRITION);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalPrice, setGoalPrice] = useState('');

  const routine = useMemo(() => planToTasks(plan), [plan]);
  const perDay = useMemo(() => {
    const weekly = (t: { points: number; schedule: Task['schedule'] }) => {
      const s = t.schedule;
      return t.points * (s.kind === 'weekly' ? s.times : s.kind === 'daily' ? s.days.length || 7 : 0);
    };
    const habitPts = [...habits].reduce((sum, i) => sum + weekly(TASK_TEMPLATES[i]), 0);
    const routinePts = routine.reduce((sum, t) => sum + weekly(t), 0);
    return Math.round((habitPts + routinePts) / 7);
  }, [habits, routine]);

  function finish(skipGoal = false) {
    const now = new Date().toISOString();
    const habitTasks: Task[] = [...habits].map((i) => {
      const t = TASK_TEMPLATES[i];
      return { id: uid('t'), title: t.title, points: t.points, attributes: t.attributes, schedule: t.schedule, special: !!t.special, archived: false, createdAt: now };
    });
    const price = Number(goalPrice);
    const goals: Goal[] =
      !skipGoal && goalTitle.trim() && price > 0
        ? [
            {
              id: uid('g'),
              title: goalTitle.trim(),
              mode: 'shopping',
              price,
              saved: 0,
              status: 'reflecting',
              createdAt: now,
              activatesAt: new Date(Date.now() + DEFAULT_SETTINGS.cooldownHours.shopping * 3_600_000).toISOString(),
            },
          ]
        : [];
    api.onboard({ name: name.trim() || session.name, color, createdAt: now }, [...routine, ...habitTasks], goals, nutri ? { nutrition: nutri } : {});
  }

  const optional = step === 3 || step === 4;
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish(false));

  return (
    <div className="onb">
      <div className="onb-inner">
        <div className="onb-progress">
          {STEPS.map((s, i) => (
            <button key={s} className={`onb-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => i < step && setStep(i)} disabled={i > step}>
              <span className="onb-dot">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              <span className="onb-step-label">{s}</span>
            </button>
          ))}
        </div>

        {step === 0 && (
          <section className="onb-section">
            <h1>Profilul tău</h1>
            <p className="onb-lead">Fiecare activitate îți crește una dintre cele 8 laturi și îți aduce credite pentru obiectivele tale.</p>
            <div className="onb-avatar-card">
              <ProfileAvatar name={name || '?'} color={color} size={96} progress={0.15} level={1} />
              <div>
                <b className="onb-avatar-name">{name || '…'}</b>
                <div className="muted small">Nivel 1 · Începător · 8 laturi de dezvoltare</div>
              </div>
            </div>
            <div className="field mt-16">
              <label>Cum te cheamă?</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </div>
            <div className="field mt-12">
              <label>Culoarea ta</label>
              <div className="row wrap">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} className={`color-swatch lg ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Culoare ${c}`} />
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="onb-section">
            <h1>Cum arată ziua ta?</h1>
            <p className="onb-lead">Reperele fixe apar în fiecare zi pe drum. Le poți schimba oricând.</p>
            <DayPlanForm value={plan} onChange={setPlan} />
          </section>
        )}

        {step === 2 && (
          <section className="onb-section">
            <h1>Ce obiceiuri construiești?</h1>
            <p className="onb-lead">
              Începe cu 3–5. Le poți schimba oricând din Plan.
            </p>
            <div className="habit-grid">
              {TASK_TEMPLATES.map((t, i) => {
                const on = habits.has(i);
                const a = ATTRIBUTE_MAP[t.attributes[0]];
                return (
                  <button
                    key={t.title}
                    className={`habit-card ${on ? 'on' : ''}`}
                    style={{ ['--c' as string]: a.color }}
                    onClick={() => setHabits((h) => {
                      const n = new Set(h);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })}
                    aria-pressed={on}
                  >
                    <span className="habit-icon">
                      <AttrIcon attr={t.attributes[0]} size={18} />
                    </span>
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <b>{t.title}</b>
                      <small>
                        {scheduleLabel({ schedule: t.schedule } as Task)} · {a.label}
                      </small>
                    </span>
                    <span className="habit-pts">+{t.points}</span>
                    <span className="habit-check">{on && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onb-section">
            <h1>Vrei ținte de nutriție?</h1>
            <p className="onb-lead">Calculez câte calorii, proteine, carbohidrați și grăsimi îți trebuie. Seara primești un scor după cât de bine te-ai încadrat.</p>
            {nutri ? (
              <>
                <NutritionForm value={nutri} onChange={setNutri} />
                <p className="small mt-12">
                  Ținta ta: <b className="num">{fmt(computedTargets(nutri).kcal)} kcal</b> pe zi.
                </p>
              </>
            ) : (
              <button className="btn" onClick={() => setNutri(DEFAULT_NUTRITION)}>
                Vreau totuși ținte de nutriție
              </button>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="onb-section">
            <h1>Primul tău obiectiv</h1>
            <p className="onb-lead">Ce ți-ai dori să cumperi din munca ta? Va sta 48 de ore „în reflecție” înainte să poți strânge credite pentru el — ca să fie o decizie, nu un impuls.</p>
            <div className="row wrap">
              {GOAL_IDEAS.map(([t, p]) => (
                <button key={t} className={`chip ${goalTitle === t ? 'on' : ''}`} onClick={() => (setGoalTitle(t), setGoalPrice(String(p)))}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-2 mt-16">
              <div className="field">
                <label>Ce îți dorești?</label>
                <input className="input" placeholder="ex. Laptop nou" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              </div>
              <div className="field">
                <label>Cât costă?</label>
                <div className="input-suffix">
                  <input className="input num" type="number" min={1} placeholder="6000" value={goalPrice} onChange={(e) => setGoalPrice(e.target.value)} />
                  <span>lei</span>
                </div>
              </div>
            </div>
            {Number(goalPrice) > 0 && perDay > 0 && (
              <div className="onb-estimate">
                <span className="display num">{Math.ceil(Number(goalPrice) / perDay)}</span>
                <span>
                  zile de muncă pentru {lei(Number(goalPrice))}
                  <small>la ritmul estimat de ~{perDay} credite pe zi (1 credit = 1 leu)</small>
                </span>
              </div>
            )}
          </section>
        )}

        <div className="onb-actions">
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Înapoi
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            {optional && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (step === 3) {
                    setNutri(null);
                    setStep(4);
                  } else finish(true);
                }}
              >
                Sari peste
              </button>
            )}
            <button className="btn btn-primary onb-next" onClick={next} disabled={(step === 0 && !name.trim()) || (step === 2 && habits.size === 0)}>
              {step === STEPS.length - 1 ? 'Pornește la drum' : 'Continuă'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <p className="onb-foot muted tiny">
          {routine.length} repere + {habits.size} obiceiuri · ~{perDay} credite pe zi
        </p>
      </div>
    </div>
  );
}
