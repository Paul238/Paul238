import { Check, Lock, Pencil, Plus, Search, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { activeBonus, previewReward, scheduleLabel, weekCount } from '../domain/engine';
import { FOOD_DB, dayTotals, evaluateTime, hhmmOf, nutritionScore, scaleFood, sumFoods, targetsFor } from '../domain/nutrition';
import type { AttributeKey, MacroTargets, Task } from '../domain/types';
import { useApp } from '../state/store';
import { Burst } from '../ui/Art';
import { fmt } from '../ui/format';
import { AttrTag } from '../ui/icons';
import { BonusCard } from '../views/BonusCard';

export function Sheet({ onClose, children, accent }: { onClose: () => void; children: ReactNode; accent?: string }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.overlay') && close();
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

function XpChips({ xp }: { xp: Partial<Record<AttributeKey, number>> }) {
  return (
    <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
      {Object.entries(xp).map(([k, v]) => (
        <span key={k} className="xp-chip" style={{ ['--c' as string]: ATTRIBUTE_MAP[k as AttributeKey].color }}>
          +{v} XP {ATTRIBUTE_MAP[k as AttributeKey].label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- sarcină obișnuită ---------------- */

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
    notify({ kind: isBonus ? 'bonus' : 'success', title: `+${reward.credits} credite`, body: isBonus ? 'Provocare cucerită!' : 'În rucsac!' });
    setTimeout(onClose, 700);
  }

  return (
    <Sheet onClose={onClose} accent={main.color}>
      <div className="sheet-eyebrow">
        {isBonus ? (
          <span style={{ color: 'var(--gold)' }}>
            <Sparkles size={13} /> Provocare ×{bonus!.multiplier}
          </span>
        ) : (
          <span>
            Etapă · {scheduleLabel(task)}
            {task.time ? ` · în jur de ${task.time}` : ''}
          </span>
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
        <XpChips xp={done ? completion!.xp : reward.xp} />
      </div>

      <div className="sheet-actions">
        {done ? (
          <button className="btn btn-block" style={{ height: 48 }} onClick={() => (api.undoCompletion(completion!.id), onClose())}>
            <Undo2 size={17} /> Scoate din rucsac (anulează)
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

/* ---------------- reper cu oră ---------------- */

function diffText(diff: number) {
  const a = Math.abs(diff);
  const t = a >= 60 ? `${Math.floor(a / 60)} h ${a % 60} min` : `${a} min`;
  return diff > 0 ? `${t} după țintă` : diff < 0 ? `${t} înainte de țintă` : 'fix la țintă';
}

export function TimeSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, api, today, notify } = useApp();
  const task = state.tasks.find((t) => t.id === taskId);
  const completion = state.completions.find((c) => c.taskId === taskId && c.date === today);
  const [value, setValue] = useState(() => hhmmOf(new Date().toISOString()));
  if (!task || !task.time) return null;
  const mode = task.timeMode ?? 'by';
  const tol = task.tolerance ?? 0;
  const preview = evaluateTime(task.time, mode, tol, value);
  const main = ATTRIBUTE_MAP[task.attributes[0] ?? 'discipline'];
  const rule =
    mode === 'by' ? `cel târziu la ${task.time}${tol ? ` (toleranță ${tol} min)` : ''}` : mode === 'after' ? `cel devreme la ${task.time}${tol ? ` (toleranță ${tol} min)` : ''}` : `doar notez ora (reper ${task.time})`;

  return (
    <Sheet onClose={onClose} accent={main.color}>
      <div className="sheet-eyebrow">Reper cu oră · {rule}</div>
      <h2 className="sheet-title">{task.title}</h2>

      {completion ? (
        <>
          <div className={`time-result ${completion.success ? 'ok' : 'bad'}`}>
            <div>
              <div className="eyebrow-label">Notat la</div>
              <div className="time-big num">{completion.value}</div>
              <div className="small">{completion.success ? (mode === 'log' ? 'Notat' : 'Respectat ✓') : 'Ratat · ' + diffText(evaluateTime(task.time, mode, tol, completion.value!).diff)}</div>
            </div>
            <div className="sheet-credits num">+{completion.credits}</div>
          </div>
          <button className="btn btn-block mt-16" style={{ height: 48 }} onClick={() => (api.undoCompletion(completion.id), onClose())}>
            <Undo2 size={17} /> Anulează notarea
          </button>
        </>
      ) : (
        <>
          <div className="time-pick">
            <div>
              <div className="eyebrow-label">Ținta</div>
              <div className="time-target num">{task.time}</div>
            </div>
            <div className="time-arrow">→</div>
            <label className="time-input">
              <span className="eyebrow-label">Ora reală</span>
              <input type="time" value={value} onChange={(e) => setValue(e.target.value || value)} className="num" />
            </label>
          </div>
          <div className={`time-preview ${preview.success ? 'ok' : 'bad'}`}>
            {preview.success
              ? `${mode === 'log' ? 'Se notează' : 'La timp'} · +${previewReward(state, task, new Date().toISOString()).credits} credite`
              : `${diffText(preview.diff)} · 0 credite (se notează totuși)`}
          </div>
          <div className="sheet-actions">
            <button
              className="btn btn-block btn-primary sheet-cta"
              onClick={() => {
                api.completeTask(task.id, value);
                notify({ kind: preview.success ? 'success' : 'info', title: preview.success ? 'Reper respectat' : 'Reper notat', body: `${task.title} · ${value}` });
                setTimeout(onClose, 500);
              }}
            >
              <Check size={20} strokeWidth={3} /> Notează {value}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------------- masă ---------------- */

interface Pick {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  per: '100g' | 'portion';
  unit?: { label: string; grams: number };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function MacroBars({ totals, targets }: { totals: MacroTargets; targets: MacroTargets }) {
  const rows: { k: keyof MacroTargets; label: string; unit: string; color: string }[] = [
    { k: 'kcal', label: 'Calorii', unit: 'kcal', color: '#ff9a4d' },
    { k: 'protein', label: 'Proteine', unit: 'g', color: '#5b9dff' },
    { k: 'carbs', label: 'Carbohidrați', unit: 'g', color: '#eaa13a' },
    { k: 'fat', label: 'Grăsimi', unit: 'g', color: '#b583f5' },
  ];
  return (
    <div className="macros">
      {rows.map((r) => {
        const v = totals[r.k];
        const t = targets[r.k];
        const ratio = t ? v / t : 0;
        const inZone = Math.abs(ratio - 1) <= 0.1;
        return (
          <div key={r.k} className="macro-row">
            <div className="row-between small">
              <span className="strong">{r.label}</span>
              <span className={`num ${inZone ? 'zone-ok' : ratio > 1.1 ? 'zone-over' : 'muted'}`}>
                {fmt(v)} / {fmt(t)} {r.unit}
              </span>
            </div>
            <div className="macro-track">
              <div className="macro-zone" />
              <div className="macro-fill" style={{ width: `${Math.min(1.25, ratio) * 80}%`, background: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MealSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, api, today, notify } = useApp();
  const task = state.tasks.find((t) => t.id === taskId);
  const completion = state.completions.find((c) => c.taskId === taskId && c.date === today);
  const log = state.meals.find((m) => m.date === today && m.taskId === taskId);
  const foods = log?.foods ?? [];
  const closed = !!state.days[today];
  const profile = state.settings.nutrition;

  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Pick | null>(null);
  const [amount, setAmount] = useState('100');
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [saveCustom, setSaveCustom] = useState(true);

  const options: Pick[] = useMemo(() => {
    const mine: Pick[] = state.foods.map((f) => ({ ...f }));
    const db: Pick[] = FOOD_DB.map((f) => ({ ...f, per: '100g' as const }));
    const all = [...mine, ...db];
    if (!q.trim()) return mine.slice(0, 6).concat(db.slice(0, 6 - Math.min(6, mine.length)));
    const nq = norm(q.trim());
    return all.filter((f) => norm(f.name).includes(nq)).slice(0, 8);
  }, [q, state.foods]);

  if (!task) return null;
  const amt = Number(amount) || 0;
  const computed = pick ? (pick.per === '100g' ? scaleFood(pick, amt) : scaleFood(pick, amt * 100)) : null;
  const mealTotals = sumFoods(foods);

  function addPicked() {
    if (!pick || !computed || amt <= 0) return;
    api.addFood(today, taskId, { name: pick.name, grams: pick.per === '100g' ? amt : undefined, ...computed });
    setPick(null);
    setQ('');
  }

  function addCustom() {
    const v = { kcal: Number(cf.kcal) || 0, protein: Number(cf.protein) || 0, carbs: Number(cf.carbs) || 0, fat: Number(cf.fat) || 0 };
    if (!cf.name.trim() || v.kcal <= 0) return;
    api.addFood(today, taskId, { name: cf.name.trim(), ...v });
    if (saveCustom) api.saveFood({ name: cf.name.trim(), per: 'portion', ...v });
    setCf({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
    setCustom(false);
  }

  return (
    <Sheet onClose={onClose} accent="#3cc48d">
      <div className="sheet-eyebrow">
        Masă{task.time ? ` · în jur de ${task.time}` : ''}
        {closed && (
          <span>
            · <Lock size={12} /> zi încheiată
          </span>
        )}
      </div>
      <h2 className="sheet-title">{task.title}</h2>

      {foods.length > 0 && (
        <div className="food-list">
          {foods.map((f) => (
            <div key={f.id} className="food-row">
              <div className="grow">
                <div className="strong small">
                  {f.name}
                  {f.grams ? <span className="muted"> · {fmt(f.grams)} g</span> : null}
                </div>
                <div className="tiny muted num">
                  P {f.protein} · C {f.carbs} · G {f.fat}
                </div>
              </div>
              <span className="num strong">{fmt(f.kcal)} kcal</span>
              {!closed && (
                <button className="btn btn-ghost btn-icon" onClick={() => api.removeFood(today, taskId, f.id)} aria-label="Șterge">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="food-row total">
            <span className="grow strong small">Total masă</span>
            <span className="tiny muted num">
              P {Math.round(mealTotals.protein)} · C {Math.round(mealTotals.carbs)} · G {Math.round(mealTotals.fat)}
            </span>
            <span className="num strong">{fmt(mealTotals.kcal)} kcal</span>
          </div>
        </div>
      )}

      {!closed && !custom && (
        <div className="food-add">
          {!pick ? (
            <>
              <div className="input-icon">
                <Search size={15} />
                <input className="input" placeholder="Caută un aliment (ex. ou, orez, pui)…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="food-options">
                {options.map((o) => (
                  <button
                    key={o.name}
                    className="food-option"
                    onClick={() => {
                      setPick(o);
                      setAmount(o.per === 'portion' ? '1' : String(o.unit?.grams ?? 100));
                    }}
                  >
                    <span className="grow" style={{ textAlign: 'left' }}>
                      {o.name}
                    </span>
                    <span className="tiny muted num">
                      {o.kcal} kcal / {o.per === '100g' ? '100 g' : 'porție'}
                    </span>
                  </button>
                ))}
                {options.length === 0 && <span className="muted small">Nu am găsit „{q}”. Adaugă-l ca aliment propriu.</span>}
              </div>
              <button className="btn btn-sm btn-ghost mt-8" onClick={() => (setCustom(true), setCf((c) => ({ ...c, name: q })))}>
                <Plus size={14} /> Aliment propriu (introduci valorile)
              </button>
            </>
          ) : (
            <div className="food-pick">
              <div className="row-between">
                <b>{pick.name}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => setPick(null)}>
                  Schimbă
                </button>
              </div>
              <div className="row wrap mt-8">
                <div className="input-suffix" style={{ width: 130 }}>
                  <input className="input num" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
                  <span>{pick.per === '100g' ? 'g' : 'porții'}</span>
                </div>
                {pick.unit &&
                  [1, 2, 3].map((k) => (
                    <button key={k} className="chip" onClick={() => setAmount(String(pick.unit!.grams * k))}>
                      {k} {pick.unit!.label}
                    </button>
                  ))}
              </div>
              {computed && (
                <div className="food-preview num">
                  <b>{fmt(computed.kcal)} kcal</b> · P {computed.protein} g · C {computed.carbs} g · G {computed.fat} g
                </div>
              )}
              <button className="btn btn-primary btn-block mt-12" onClick={addPicked} disabled={amt <= 0}>
                <Plus size={16} /> Adaugă în {task.title.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}

      {!closed && custom && (
        <div className="food-pick">
          <div className="row-between">
            <b>Aliment propriu (pe porția consumată)</b>
            <button className="btn btn-ghost btn-sm" onClick={() => setCustom(false)}>
              Înapoi
            </button>
          </div>
          <input className="input mt-8" placeholder="Denumire (ex. Ciorbă de burtă)" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} />
          <div className="grid grid-4 mt-8" style={{ gap: 8 }}>
            {(
              [
                ['kcal', 'kcal'],
                ['protein', 'P (g)'],
                ['carbs', 'C (g)'],
                ['fat', 'G (g)'],
              ] as const
            ).map(([k, l]) => (
              <div key={k} className="field">
                <label>{l}</label>
                <input className="input num" type="number" min={0} value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <label className="row small mt-8" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={saveCustom} onChange={(e) => setSaveCustom(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Salvează în alimentele mele, ca să-l găsesc data viitoare
          </label>
          <button className="btn btn-primary btn-block mt-12" onClick={addCustom} disabled={!cf.name.trim() || !(Number(cf.kcal) > 0)}>
            <Plus size={16} /> Adaugă
          </button>
        </div>
      )}

      {profile && (
        <div className="mt-16">
          <div className="eyebrow-label">Azi, până acum</div>
          <MacroBars totals={dayTotals(state, today)} targets={targetsFor(profile)} />
        </div>
      )}

      <div className="sheet-actions">
        {completion ? (
          <button className="btn btn-block" style={{ height: 48 }} onClick={() => api.undoCompletion(completion.id)} disabled={closed}>
            <Check size={17} /> Masă notată · +{completion.credits} {closed ? '' : '(anulează)'}
          </button>
        ) : (
          <button
            className="btn btn-block btn-primary sheet-cta"
            disabled={foods.length === 0 || closed}
            onClick={() => {
              api.completeTask(task.id);
              notify({ kind: 'success', title: `${task.title} notat`, body: `${fmt(mealTotals.kcal)} kcal în rucsac.` });
              setTimeout(onClose, 500);
            }}
          >
            <Check size={20} strokeWidth={3} /> {foods.length === 0 ? 'Adaugă ce ai mâncat' : `Am mâncat · +${task.points}`}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- sumarul nutriției zilei ---------------- */

export function NutritionSheet({ onClose, onSetup }: { onClose: () => void; onSetup: () => void }) {
  const { state, api, today } = useApp();
  const profile = state.settings.nutrition;
  const closed = state.days[today];
  const totals = dayTotals(state, today);
  const meals = state.meals.filter((m) => m.date === today && m.foods.length);
  const targets = profile ? targetsFor(profile) : null;
  const score = targets ? nutritionScore(totals, targets).score : 0;

  return (
    <Sheet onClose={onClose} accent="#3cc48d">
      <div className="sheet-eyebrow">Nutriția zilei</div>
      <h2 className="sheet-title">
        {fmt(totals.kcal)} {targets ? <span className="muted">/ {fmt(targets.kcal)}</span> : null} kcal
      </h2>
      {!profile ? (
        <>
          <p className="text-2">Ca să știu câte calorii, proteine, carbohidrați și grăsimi îți trebuie, am nevoie de câteva date: greutate, înălțime, vârstă, activitate și obiectiv.</p>
          <button className="btn btn-primary btn-block mt-16" style={{ height: 48 }} onClick={onSetup}>
            Setează profilul nutrițional
          </button>
        </>
      ) : (
        <>
          <MacroBars totals={totals} targets={targets!} />
          <div className="sheet-reward">
            <div>
              <div className="eyebrow-label">{closed?.nutrition ? 'Scor final' : 'Scor estimat'}</div>
              <div className="sheet-credits num">{Math.round((closed?.nutrition?.score ?? score) * 100)}%</div>
              <div className="muted small">încadrare în calorii și macronutrienți (±10% = perfect)</div>
            </div>
            <div className="col" style={{ alignItems: 'flex-end' }}>
              <span className="eyebrow-label">Credite</span>
              <span className="display num" style={{ fontSize: 30, color: 'var(--gold)' }}>
                +{closed?.nutrition?.credits ?? Math.round(profile.points * score)}
              </span>
            </div>
          </div>
          {meals.length > 0 && (
            <div className="food-list mt-16">
              {meals.map((m) => {
                const t = sumFoods(m.foods);
                return (
                  <div key={m.id} className="food-row">
                    <span className="grow strong small">{state.tasks.find((x) => x.id === m.taskId)?.title ?? 'Masă'}</span>
                    <span className="tiny muted num">
                      P {Math.round(t.protein)} · C {Math.round(t.carbs)} · G {Math.round(t.fat)}
                    </span>
                    <span className="num strong">{fmt(t.kcal)} kcal</span>
                  </div>
                );
              })}
            </div>
          )}
          {closed ? (
            <p className="muted small mt-16">
              <Lock size={12} /> Ziua a fost încheiată. Creditele au fost adăugate în portofel.
            </p>
          ) : (
            <>
              <button className="btn btn-block mt-16" style={{ height: 48 }} disabled={meals.length === 0} onClick={() => api.closeDay(today)}>
                Încheie ziua și primește creditele
              </button>
              <p className="muted tiny mt-8">Dacă nu o închizi tu, ziua se încheie automat după miezul nopții. După încheiere, mesele de azi nu mai pot fi modificate.</p>
            </>
          )}
        </>
      )}
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
        <Sparkles size={13} /> Ai găsit un cufăr pe drum
      </div>
      <div className="reveal-anim">
        <BonusCard bonus={bonus} />
      </div>
      <p className="muted small mt-12">Etapa strălucește acum auriu pe drum. O poți bifa de acolo sau de aici.</p>
    </Sheet>
  );
}
