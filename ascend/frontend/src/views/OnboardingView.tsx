import { ArrowLeft, ArrowRight, Gift, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTES } from '../domain/attributes';
import { DEFAULT_SETTINGS, scheduleLabel } from '../domain/engine';
import { uid } from '../domain/id';
import { AVATAR_COLORS, TASK_TEMPLATES } from '../domain/templates';
import type { Goal, Task } from '../domain/types';
import { useApp } from '../state/store';
import { Avatar } from '../ui/components';
import { lei } from '../ui/format';
import { AttrTag } from '../ui/icons';

interface Pick {
  on: boolean;
  special: boolean;
  points: number;
}

export function OnboardingView() {
  const { session, api } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(session.name);
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [picks, setPicks] = useState<Pick[]>(() =>
    TASK_TEMPLATES.map((t, i) => ({ on: [0, 2, 4, 9, 12, 15].includes(i), special: !!t.special, points: t.points })),
  );
  const [rate, setRate] = useState(DEFAULT_SETTINGS.leiPerCredit);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalPrice, setGoalPrice] = useState('');

  const selected = picks.filter((p) => p.on);
  const dailyEstimate = useMemo(
    () =>
      TASK_TEMPLATES.reduce((sum, t, i) => {
        const p = picks[i];
        if (!p.on) return sum;
        const s = t.schedule;
        const perWeek = s.kind === 'weekly' ? s.times : s.kind === 'daily' ? (s.days.length || 7) : 0;
        return sum + (p.points * perWeek) / 7;
      }, 0),
    [picks],
  );

  function finish() {
    const now = new Date().toISOString();
    const tasks: Task[] = TASK_TEMPLATES.flatMap((t, i) =>
      picks[i].on
        ? [{ id: uid('t'), title: t.title, points: picks[i].points, attributes: t.attributes, schedule: t.schedule, special: picks[i].special, archived: false, createdAt: now }]
        : [],
    );
    const price = Number(goalPrice);
    const goals: Goal[] =
      goalTitle.trim() && price > 0
        ? [{ id: uid('g'), title: goalTitle.trim(), mode: 'shopping', price, saved: 0, status: 'reflecting', createdAt: now, activatesAt: new Date(Date.now() + DEFAULT_SETTINGS.cooldownHours.shopping * 3_600_000).toISOString() }]
        : [];
    api.onboard({ name: name.trim() || session.name, color, createdAt: now }, tasks, goals, { leiPerCredit: rate });
  }

  const set = (i: number, patch: Partial<Pick>) => setPicks((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="onboard">
      <div className="steps">
        {[0, 1, 2].map((i) => (
          <div key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="col" style={{ gap: 24 }}>
          <div>
            <p className="muted small">Pasul 1 din 3</p>
            <h1 className="mt-8">Creează-ți personajul</h1>
            <p className="muted mt-8">Personajul te reprezintă: crește în nivel pe măsură ce lucrezi la tine.</p>
          </div>
          <div className="card row gap-16">
            <Avatar name={name || '?'} color={color} size="lg" />
            <div className="grow col" style={{ gap: 12 }}>
              <div className="field">
                <label>Nume afișat</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </div>
              <div className="row">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} className={`color-swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Culoare ${c}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <h2>Cele 8 atribute</h2>
            <p className="muted small mt-8">Fiecare sarcină dă XP unuia sau mai multor atribute. Nivelul general al personajului este suma lor.</p>
            <div className="grid grid-2 mt-16" style={{ gap: 10 }}>
              {ATTRIBUTES.map((a) => (
                <div key={a.key} className="col" style={{ gap: 2 }}>
                  <AttrTag attr={a.key} />
                  <span className="muted small">{a.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStep(1)} disabled={!name.trim()}>
              Continuă <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="col" style={{ gap: 20 }}>
          <div>
            <p className="muted small">Pasul 2 din 3</p>
            <h1 className="mt-8">Alege primele sarcini</h1>
            <p className="muted mt-8">
              Poți modifica totul oricând. Marchează cu <Star size={13} style={{ verticalAlign: -2 }} /> sarcinile pe care le poți face oricând: ele intră în
              <strong> lista specială</strong> și pot apărea aleatoriu ca provocări de 24h cu puncte ×5.
            </p>
          </div>
          <div className="card card-flush">
            {TASK_TEMPLATES.map((t, i) => (
              <div key={t.title} className="template-row">
                <input type="checkbox" checked={picks[i].on} onChange={(e) => set(i, { on: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                <div className="grow">
                  <div className="task-title">{t.title}</div>
                  <div className="task-meta">
                    <span>{scheduleLabel({ schedule: t.schedule } as Task)}</span>
                    {t.attributes.map((a) => (
                      <AttrTag key={a} attr={a} />
                    ))}
                  </div>
                </div>
                <button
                  className={`btn btn-ghost btn-icon ${picks[i].special ? '' : 'muted'}`}
                  title="Lista specială (provocări ×5)"
                  onClick={() => set(i, { special: !picks[i].special, on: true })}
                  style={{ color: picks[i].special ? 'var(--gold)' : undefined }}
                >
                  <Star size={16} fill={picks[i].special ? 'currentColor' : 'none'} />
                </button>
                <div className="input-suffix" style={{ width: 92 }}>
                  <input className="input num" type="number" min={1} max={500} value={picks[i].points} onChange={(e) => set(i, { points: Math.max(1, Number(e.target.value) || 1) })} />
                  <span>pct</span>
                </div>
              </div>
            ))}
          </div>
          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Înapoi
            </button>
            <div className="row">
              <span className="muted small">{selected.length} sarcini · ~{Math.round(dailyEstimate)} puncte/zi</span>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={selected.length === 0}>
                Continuă <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="col" style={{ gap: 20 }}>
          <div>
            <p className="muted small">Pasul 3 din 3</p>
            <h1 className="mt-8">Economia ta</h1>
            <p className="muted mt-8">Punctele devin credite. Stabilește cât valorează un credit în lei.</p>
          </div>
          <div className="card col" style={{ gap: 16 }}>
            <div className="field">
              <label>Valoarea unui credit</label>
              <div className="input-suffix" style={{ maxWidth: 200 }}>
                <input className="input num" type="number" min={0.1} step={0.1} value={rate} onChange={(e) => setRate(Math.max(0.1, Number(e.target.value) || 1))} />
                <span>lei</span>
              </div>
              <span className="hint">
                La ritmul estimat (~{Math.round(dailyEstimate)} credite/zi) strângi aproximativ {lei(dailyEstimate * 30 * rate)} pe lună.
              </span>
            </div>
            <div className="divider" />
            <div>
              <h2>Primul obiectiv (opțional)</h2>
              <p className="muted small mt-8">Ceva ce îți dorești să cumperi. Va intra 48h în reflecție înainte să poți aloca credite.</p>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Ce îți dorești?</label>
                <input className="input" placeholder="ex. Laptop nou" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              </div>
              <div className="field">
                <label>Preț</label>
                <div className="input-suffix">
                  <input className="input num" type="number" min={1} placeholder="6000" value={goalPrice} onChange={(e) => setGoalPrice(e.target.value)} />
                  <span>lei</span>
                </div>
              </div>
            </div>
            {Number(goalPrice) > 0 && dailyEstimate > 0 && (
              <div className="notice notice-gold">
                <Gift size={16} />
                <span>
                  {lei(Number(goalPrice))} = {Math.ceil(Number(goalPrice) / rate).toLocaleString('ro-RO')} credite ≈{' '}
                  <strong>{Math.ceil(Number(goalPrice) / rate / dailyEstimate)} zile</strong> de muncă la ritmul estimat.
                </span>
              </div>
            )}
          </div>
          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Înapoi
            </button>
            <button className="btn btn-primary" onClick={finish}>
              Începe <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
