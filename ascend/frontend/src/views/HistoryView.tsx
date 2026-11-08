import { Activity, ShoppingCart, Target, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { addDays, keyOf, parseKey, weekStart } from '../domain/dates';
import { METRIC_MAP } from '../domain/metrics';
import { CATEGORY_MAP, monthSummary } from '../domain/money';
import { useApp } from '../state/store';
import { fmt, fmt1, ron as lei } from '../ui/format';
import { StageGlyph } from '../ui/stage';

type Filter = 'all' | 'tasks' | 'money' | 'metrics';

interface Entry {
  key: string;
  date: string;
  at: string;
  kind: 'task' | 'shop' | 'goal' | 'metric';
  title: string;
  sub?: string;
  credits?: number;
  money?: number;
  income?: number;
  color: string;
  taskId?: string;
}

function dayLabel(d: string, today: string) {
  if (d === today) return 'Azi';
  if (d === addDays(today, -1)) return 'Ieri';
  const s = parseKey(d).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: d.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** istoricul: ce ai făcut în fiecare zi, punctele strânse și banii cheltuiți */
export function HistoryView() {
  const { state, today } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [limitDays, setLimitDays] = useState(30);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const c of state.completions) {
      const t = state.tasks.find((x) => x.id === c.taskId);
      const a = Object.keys(c.xp)[0] as keyof typeof ATTRIBUTE_MAP | undefined;
      out.push({
        key: c.id,
        date: c.date,
        at: c.at,
        kind: 'task',
        title: c.taskTitle,
        sub: c.value ? (c.success === false ? `notat ${c.value} · ratat` : `notat ${c.value}`) : undefined,
        credits: c.credits,
        color: a ? ATTRIBUTE_MAP[a].color : 'var(--muted)',
        taskId: t?.id,
      });
    }
    for (const i of state.shopping)
      if (i.boughtAt) out.push({ key: i.id, date: i.boughtDate!, at: i.boughtAt, kind: 'shop', title: i.title, sub: i.qty, money: i.cost, color: '#3cc48d' });
    for (const g of state.goals)
      if (g.status === 'purchased' && g.purchasedAt)
        out.push({ key: g.id, date: keyOf(g.purchasedAt), at: g.purchasedAt, kind: 'goal', title: g.title, sub: `obiectiv · ${fmt(g.paidCredits ?? 0)} credite`, money: g.paidPrice ?? g.price, color: 'var(--gold)' });
    for (const t of state.transactions)
      out.push({
        key: t.id,
        date: t.date,
        at: t.at,
        kind: 'shop',
        title: t.title,
        sub: `${CATEGORY_MAP[t.category].label}${t.recurringId ? (t.extra ? ' · plată în avans' : ' · plată fixă') : ''}`,
        money: t.type === 'expense' ? t.amount : undefined,
        income: t.type === 'income' ? t.amount : undefined,
        color: CATEGORY_MAP[t.category].color,
      });
    for (const m of state.metrics) {
      const def = METRIC_MAP[m.metric];
      if (!def) continue;
      const v = def.pair ? `${fmt(m.value)}/${fmt(m.value2 ?? 0)}` : def.step < 1 ? fmt1(m.value) : fmt(m.value);
      out.push({ key: m.id, date: m.date, at: m.at, kind: 'metric', title: def.label, sub: `${v} ${def.unit}`, color: ATTRIBUTE_MAP[def.attribute].color });
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [state]);

  const shown = entries.filter((e) => filter === 'all' || (filter === 'tasks' && e.kind === 'task') || (filter === 'money' && (e.kind === 'shop' || e.kind === 'goal')) || (filter === 'metrics' && e.kind === 'metric'));
  const from = addDays(today, -(limitDays - 1));
  const byDay = new Map<string, Entry[]>();
  for (const e of shown) if (e.date >= from) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const creditsIn = (a: string, b: string) => state.completions.filter((c) => c.date >= a && c.date <= b).reduce((s, c) => s + c.credits, 0);
  const ws = weekStart(today);
  const ms = today.slice(0, 8) + '01';
  const totalCredits = state.completions.reduce((s, c) => s + c.credits, 0);
  const goalMoney = (a: string, b: string) => state.goals.filter((g) => g.status === 'purchased' && g.purchasedAt && keyOf(g.purchasedAt) >= a && keyOf(g.purchasedAt) <= b).reduce((s, g) => s + (g.paidPrice ?? g.price), 0);
  const monthMoney = monthSummary(state, today.slice(0, 7), today).expenses + goalMoney(ms, today);

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 29);
    return { d, v: creditsIn(d, d) };
  });
  const max = Math.max(1, ...last30.map((x) => x.v));

  return (
    <div className="history">
      <div className="page-head">
        <div>
          <h1>Istoric</h1>
          <p>Ce ai făcut, câte credite ai strâns și cât ai cheltuit.</p>
        </div>
      </div>

      <div className="hist-stats">
        <div>
          <small>Credite săptămâna asta</small>
          <b className="num">{fmt(creditsIn(ws, today))}</b>
        </div>
        <div>
          <small>Credite luna asta</small>
          <b className="num">{fmt(creditsIn(ms, today))}</b>
        </div>
        <div>
          <small>Credite de la început</small>
          <b className="num">{fmt(totalCredits)}</b>
        </div>
        <div>
          <small>Cheltuit luna asta</small>
          <b className="num">{lei(monthMoney)}</b>
        </div>
      </div>

      <div className="card hist-chart">
        <div className="row-between small">
          <span className="strong">Credite pe zi · ultimele 30 de zile</span>
          <span className="muted">max {fmt(max)}</span>
        </div>
        <div className="hist-bars">
          {last30.map((x) => (
            <span key={x.d} title={`${dayLabel(x.d, today)} · ${x.v} credite`} className={x.d === today ? 'today' : ''} style={{ height: `${Math.max(3, (x.v / max) * 100)}%` }} />
          ))}
        </div>
      </div>

      <div className="segmented hist-filter">
        {(
          [
            ['all', 'Tot'],
            ['tasks', 'Activități'],
            ['money', 'Bani'],
            ['metrics', 'Măsurători'],
          ] as [Filter, string][]
        ).map(([f, l]) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {l}
          </button>
        ))}
      </div>

      {byDay.size === 0 && <div className="card empty mt-16">Nimic în această perioadă.</div>}
      {[...byDay.entries()].map(([d, list]) => {
        const cr = list.reduce((s, e) => s + (e.credits ?? 0), 0);
        const money = list.reduce((s, e) => s + (e.money ?? 0), 0);
        return (
          <section key={d} className="hist-day">
            <div className="hist-day-head">
              <b>{dayLabel(d, today)}</b>
              <span className="muted small">
                {cr > 0 && <span className="gold strong">+{fmt(cr)} credite</span>}
                {cr > 0 && money > 0 && ' · '}
                {money > 0 && <span>{lei(money)} cheltuiți</span>}
              </span>
            </div>
            <div className="card card-flush">
              {list.map((e) => {
                const t = e.taskId ? state.tasks.find((x) => x.id === e.taskId) : undefined;
                return (
                  <div key={e.key} className="hist-row">
                    <span className="hist-icon" style={{ ['--c' as string]: e.color }}>
                      {e.kind === 'task' && t ? <StageGlyph task={t} size={15} /> : e.kind === 'task' ? <Activity size={15} /> : e.kind === 'shop' ? <ShoppingCart size={15} /> : e.kind === 'goal' ? <Target size={15} /> : <TrendingUp size={15} />}
                    </span>
                    <span className="grow">
                      <b>{e.title}</b>
                      <small>
                        {new Date(e.at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        {e.sub ? ` · ${e.sub}` : ''}
                      </small>
                    </span>
                    {e.credits !== undefined && <span className="hist-credits num">+{fmt(e.credits)}</span>}
                    {e.money !== undefined && <span className="hist-money num">−{lei(e.money)}</span>}
                    {e.income !== undefined && <span className="hist-credits num" style={{ color: 'var(--success)' }}>+{lei(e.income)}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {entries.some((e) => e.date < from) && (
        <button className="btn btn-block mt-16" onClick={() => setLimitDays(limitDays + 60)}>
          Arată mai vechi
        </button>
      )}
    </div>
  );
}
