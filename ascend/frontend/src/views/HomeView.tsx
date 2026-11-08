import { ChevronRight, Coins, Flame, Gift, Settings, Sparkles, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTES, ATTRIBUTE_MAP } from '../domain/attributes';
import { activeBonus, creditsOn, isCompletedOn, scheduleLabel, tasksForDay } from '../domain/engine';
import { characterTitle } from '../domain/leveling';
import { latestMetric, metricsFor, metricStatus } from '../domain/metrics';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { ProfileAvatar } from '../ui/components';
import { fmt, greeting, lei, longToday } from '../ui/format';
import { AttrIcon } from '../ui/icons';
import { StageGlyph } from '../ui/stage';
import { BonusSheet, ItemSheet, Sheet } from '../world/Sheets';
import { ActivitySearch } from './ActivitySearch';
import { MetricCard } from './MetricsPanel';
import { TaskEditor } from './TaskEditor';
import type { AppView } from './AppLayout';

/** ecranul principal: personajul, cu cele 8 laturi de dezvoltare în jurul lui */
export function HomeView({ go, openSettings, openStats }: { go: (v: AppView) => void; openSettings: () => void; openStats: () => void }) {
  const { state, derived, today, now } = useApp();
  const c = state.character!;
  const [attr, setAttr] = useState<AttributeKey | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ task?: Task; attrs?: AttributeKey[] } | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const items = useMemo(() => tasksForDay(state, today, { today }), [state, today]);
  const doneN = items.filter((i) => i.completion).length;
  const bonus = activeBonus(state, now);
  const d = new Date(now);

  return (
    <div className="home">
      <header className="home-top">
        <div>
          <div className="eyebrow-label">{longToday(d)}</div>
          <h1 className="home-hello">
            {greeting(d)}, {c.name.split(' ')[0]}
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="stat-pill" title="Zile la rând">
            <Flame size={15} className={derived.streak.activeToday ? 'flame-on' : undefined} /> <b className="num">{derived.streak.days}</b>
            {derived.streak.shields > 0 && <small>🛡{derived.streak.shields}</small>}
          </span>
          <button className="stat-pill gold" onClick={() => go('goals')} title="Credite disponibile">
            <Coins size={15} /> <b className="num">{fmt(derived.available)}</b>
          </button>
          <button className="btn btn-ghost btn-icon" onClick={openSettings} aria-label="Setări">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="home-search">
        <ActivitySearch mode="log" date={today} onOpen={(t) => setItem(t.id)} suggest={false} />
      </div>

      {bonus && (
        <button className="home-bonus" onClick={() => (bonus.revealed ? setItem(bonus.taskId) : setBonusOpen(true))}>
          <Gift size={18} />
          <span className="grow">
            <b>{bonus.revealed ? bonus.taskTitle : 'Provocare surpriză'}</b>
            <small>{bonus.revealed ? `×${bonus.multiplier} puncte dacă o faci azi` : 'Atinge ca s-o descoperi'}</small>
          </span>
          <ChevronRight size={16} />
        </button>
      )}

      {/* personajul și laturile lui */}
      <section className="orbit" aria-label="Personajul și laturile de dezvoltare">
        <div className="orbit-ring" />
        <div className="orbit-center">
          <ProfileAvatar name={c.name} color={c.color} size={128} progress={derived.level.progress} level={derived.level.level} />
          <b className="orbit-name">{c.name.split(' ')[0]}</b>
          <span className="orbit-title">
            Nivel {derived.level.level} · {characterTitle(derived.level.level)}
          </span>
          <span className="orbit-xp-text num">
            {fmt(derived.level.into)} / {fmt(derived.level.needed)} XP
          </span>
        </div>
        {ATTRIBUTES.map((a, i) => {
          const l = derived.attributes[a.key];
          const angle = (i / ATTRIBUTES.length) * Math.PI * 2 - Math.PI / 2;
          const watch = metricsFor(a.key).some((m) => metricStatus(m, latestMetric(state, m.key)) === 'watch');
          return (
            <button
              key={a.key}
              className="orbit-node"
              style={{ ['--c' as string]: a.color, ['--x' as string]: Math.cos(angle).toFixed(3), ['--y' as string]: Math.sin(angle).toFixed(3), ['--p' as string]: l.progress }}
              onClick={() => setAttr(a.key)}
              aria-label={`${a.label}, nivel ${l.level}`}
            >
              <span className="orbit-node-ring">
                <span className="orbit-node-icon">
                  <AttrIcon attr={a.key} size={20} />
                </span>
                <span className="orbit-node-badge num">{l.level}</span>
              </span>
              <span className="orbit-node-label">{a.label}</span>
              {watch && <span className="orbit-node-dot" title="O măsurătoare e de urmărit" />}
            </button>
          );
        })}
      </section>

      <div className="home-cards">
        <button className="home-card" onClick={() => go('today')}>
          <span className="home-card-ring" style={{ ['--p' as string]: items.length ? doneN / items.length : 0 }}>
            <span className="num">
              {doneN}/{items.length}
            </span>
          </span>
          <span className="grow">
            <b>Azi</b>
            <small>+{fmt(creditsOn(state, today))} credite câștigate azi</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button className="home-card" onClick={openStats}>
          <span className="home-card-icon">
            <Trophy size={20} />
          </span>
          <span className="grow">
            <b>Statistici și realizări</b>
            <small>{fmt(derived.level.total)} XP total · {lei(derived.available * state.settings.leiPerCredit)} în portofel</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>

      {attr && (
        <AttributeSheet
          attr={attr}
          onClose={() => setAttr(null)}
          onOpenTask={(id) => (setAttr(null), setItem(id))}
          onAdd={() => (setAttr(null), setEdit({ attrs: [attr] }))}
        />
      )}
      {item && <ItemSheet id={item} onClose={() => setItem(null)} onEdit={(t) => setEdit({ task: t })} />}
      {bonusOpen && <BonusSheet onClose={() => setBonusOpen(false)} />}
      {edit && <TaskEditor task={edit.task} defaultAttributes={edit.attrs} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AttributeSheet({ attr, onClose, onOpenTask, onAdd }: { attr: AttributeKey; onClose: () => void; onOpenTask: (id: string) => void; onAdd: () => void }) {
  const { state, derived, today } = useApp();
  const a = ATTRIBUTE_MAP[attr];
  const l = derived.attributes[attr];
  const metrics = metricsFor(attr);
  const tasks = state.tasks.filter((t) => !t.archived && t.attributes.includes(attr));
  const count = (id: string) => state.completions.filter((c) => c.taskId === id).length;

  return (
    <Sheet onClose={onClose} accent={a.color}>
      <div className="row" style={{ gap: 14 }}>
        <span className="attr-hero-icon" style={{ ['--c' as string]: a.color }}>
          <AttrIcon attr={attr} size={26} />
        </span>
        <div className="grow">
          <h2 className="sheet-title" style={{ margin: 0 }}>
            {a.label}
          </h2>
          <p className="muted small">{a.description}</p>
        </div>
        <div className="sheet-level num">{l.level}</div>
      </div>
      <div className="mt-12">
        <div className="row-between small">
          <span className="muted">Spre nivelul {l.level + 1}</span>
          <span className="num strong">
            {fmt(l.into)} / {fmt(l.needed)} XP
          </span>
        </div>
        <div className="attr-bar">
          <span style={{ width: `${l.progress * 100}%`, background: a.color }} />
        </div>
      </div>

      {metrics.length > 0 && (
        <>
          <div className="eyebrow-label mt-24">Datele tale</div>
          <div className="metrics-grid">
            {metrics.map((m) => (
              <MetricCard key={m.key} def={m} color={a.color} />
            ))}
          </div>
          {attr === 'health' && <p className="hint mt-8">Intervalele sunt orientative, nu sfat medical. Pentru valori „de urmărit” repetate, discută cu un medic.</p>}
        </>
      )}

      <div className="eyebrow-label mt-24">Activități care o cresc</div>
      <div className="sheet-list">
        {tasks.length === 0 && <p className="muted small">Încă nu ai activități pentru {a.label.toLowerCase()}.</p>}
        {tasks.map((t) => (
          <button key={t.id} className="sheet-list-item" onClick={() => onOpenTask(t.id)}>
            <span className={`dot-state ${isCompletedOn(state, t.id, today) ? 'on' : ''}`} style={{ ['--c' as string]: a.color }} />
            <span className="asearch-icon" style={{ ['--c' as string]: a.color }}>
              <StageGlyph task={t} size={15} />
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="strong">{t.title}</span>
              <span className="muted tiny" style={{ display: 'block' }}>
                {scheduleLabel(t)} · {count(t.id)} realizări{t.attributes[0] === attr ? '' : ' · 50% XP'}
              </span>
            </span>
            <span className="num" style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 17 }}>
              +{t.points}
            </span>
          </button>
        ))}
      </div>
      <button className="btn btn-block mt-12" style={{ height: 44 }} onClick={onAdd}>
        <Sparkles size={15} /> Activitate nouă pentru {a.label}
      </button>
    </Sheet>
  );
}
