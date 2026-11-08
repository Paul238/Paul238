import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { addDays, weekStart } from '../domain/dates';
import { attributeXp, totalEarned } from '../domain/engine';
import type { AttributeKey } from '../domain/types';
import { useApp } from '../state/store';
import { Constellation } from '../ui/Art';
import { Avatar, Bar } from '../ui/components';
import { fmt, fmtDate } from '../ui/format';
import { AttrBadge } from '../ui/icons';

const WEEKS = 18;

export function CharacterView() {
  const { state, derived, today } = useApp();
  const c = state.character!;
  const xp = attributeXp(state);
  const levels = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, derived.attributes[k].level])) as Record<AttributeKey, number>;
  const [selected, setSelected] = useState<AttributeKey | null>(null);

  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of state.completions) m.set(x.date, (m.get(x.date) ?? 0) + x.credits);
    return m;
  }, [state.completions]);

  const topTask = useMemo(() => {
    const out: Partial<Record<AttributeKey, { title: string; n: number }>> = {};
    const counts = new Map<string, { title: string; n: number; attr: AttributeKey }>();
    for (const x of state.completions) {
      const a = Object.keys(x.xp)[0] as AttributeKey | undefined;
      if (!a) continue;
      const cur = counts.get(x.taskId) ?? { title: x.taskTitle, n: 0, attr: a };
      cur.n++;
      counts.set(x.taskId, cur);
    }
    for (const v of counts.values()) if (!out[v.attr] || out[v.attr]!.n < v.n) out[v.attr] = v;
    return out;
  }, [state.completions]);

  // heatmap: ultimele WEEKS săptămâni, coloane = săptămâni, rânduri = L..D
  const start = addDays(weekStart(today), -(WEEKS - 1) * 7);
  const cells: { date: string; v: number }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = addDays(start, i);
    cells.push({ date: d, v: d > today ? -1 : perDay.get(d) ?? 0 });
  }
  const maxDay = Math.max(1, ...cells.map((x) => x.v));
  const shade = (v: number) => {
    if (v < 0) return 'transparent';
    if (v === 0) return 'var(--surface-3)';
    const f = v / maxDay;
    const pct = f > 0.75 ? 100 : f > 0.5 ? 75 : f > 0.25 ? 50 : 30;
    return `color-mix(in srgb, var(--success) ${pct}%, var(--surface-3))`;
  };

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    return { d, v: perDay.get(d) ?? 0 };
  });
  const max14 = Math.max(1, ...last14.map((x) => x.v));

  return (
    <>
      <section className="char-hero">
        <div className="col" style={{ gap: 14, position: 'relative', zIndex: 1 }}>
          <div className="row">
            <Avatar name={c.name} color={c.color} />
            <div>
              <div className="strong" style={{ fontSize: 16 }}>{c.name}</div>
              <div className="muted small">pe drum din {fmtDate(c.createdAt, { month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          <div>
            <div className="eyebrow-label">Nivel</div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
              <span className="big-level num">{derived.level.level}</span>
              <span className="display" style={{ fontSize: 26, paddingBottom: 10, fontStyle: 'italic' }}>
                nivel general
              </span>
            </div>
          </div>
          <div>
            <div className="row-between small">
              <span className="muted">Spre nivelul {derived.level.level + 1}</span>
              <span className="num strong">
                {fmt(derived.level.into)} / {fmt(derived.level.needed)} XP
              </span>
            </div>
            <div className="mt-8">
              <Bar value={derived.level.progress} size="lg" />
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <MiniStat label="Altitudine" value={`${fmt(derived.level.total)} m`} />
            <MiniStat label="Etape urcate" value={fmt(state.completions.length)} />
            <MiniStat label="Activități în program" value={fmt(state.tasks.filter((t) => !t.archived).length)} />
            <MiniStat label="Credite câștigate" value={fmt(totalEarned(state))} />
          </div>
        </div>
        <Constellation
          levels={levels}
          progress={Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, derived.attributes[k].progress])) as Record<AttributeKey, number>}
          name={c.name}
          color={c.color}
          level={derived.level.level}
          selected={selected}
          onSelect={(k) => {
            setSelected(k);
            document.getElementById(`attr-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      </section>

      <div className="grid grid-main mt-24">
        <div className="col" style={{ gap: 16 }}>
          <div className="grid grid-2">
            {ATTRIBUTE_KEYS.map((k) => {
              const l = derived.attributes[k];
              const a = ATTRIBUTE_MAP[k];
              return (
                <div key={k} id={`attr-${k}`} className="card attr-card" style={{ ['--c' as string]: a.color, outline: selected === k ? `2px solid ${a.color}` : undefined }}>
                  <div className="row-between">
                    <div className="row">
                      <AttrBadge attr={k} size={32} />
                      <div className="col" style={{ gap: 0 }}>
                        <span className="strong">{a.label}</span>
                        <span className="muted tiny">{a.description}</span>
                      </div>
                    </div>
                    <span className="attr-level">{l.level}</span>
                  </div>
                  <Bar value={l.progress} color={a.color} />
                  <div className="row-between tiny muted">
                    <span>
                      {fmt(l.into)} / {fmt(l.needed)} XP · total {fmt(xp[k])}
                    </span>
                    <span className="truncate" style={{ maxWidth: '50%' }}>
                      {topTask[k] ? `Top: ${topTask[k]!.title}` : 'Nicio activitate'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Activitate</h2>
              <span className="muted tiny">{WEEKS} săptămâni</span>
            </div>
            <div className="heatmap">
              {cells.map((x) => (
                <div key={x.date} className="heat" style={{ background: shade(x.v) }} title={x.v >= 0 ? `${fmtDate(x.date)} · ${x.v} credite` : ''} />
              ))}
            </div>
            <div className="legend mt-8">
              mai puțin
              {[0, 0.2, 0.4, 0.7, 1].map((f) => (
                <span key={f} className="heat" style={{ background: shade(f * maxDay) }} />
              ))}
              mai mult
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Credite pe zi</h2>
              <span className="muted tiny">ultimele 14 zile</span>
            </div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 90 }}>
              {last14.map((x) => (
                <div key={x.d} className="grow" title={`${fmtDate(x.d)} · ${x.v}`} style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.max(3, (x.v / max14) * 100)}%`, background: x.d === today ? 'var(--accent)' : x.v ? 'color-mix(in srgb, var(--accent) 55%, var(--surface-3))' : 'var(--surface-3)', borderRadius: 3 }} />
                </div>
              ))}
            </div>
            <div className="row-between tiny muted mt-8">
              <span>{fmtDate(last14[0].d, { day: 'numeric', month: 'short' })}</span>
              <span>azi</span>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
      <div className="muted tiny">{label}</div>
      <div className="strong num">{value}</div>
    </div>
  );
}
