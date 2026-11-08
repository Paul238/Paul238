import { BarChart3, ChevronRight, Coins, Settings, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTRIBUTES } from '../domain/attributes';
import { creditsOn, tasksForDay } from '../domain/engine';
import { activeMetrics, latestMetric, metricStatus } from '../domain/metrics';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { ProfileAvatar } from '../ui/components';
import { fmt, greeting, lei, longToday } from '../ui/format';
import { AttrIcon } from '../ui/icons';
import { ItemSheet } from '../world/Sheets';
import { ActivitySearch } from './ActivitySearch';
import { AreaSheet, AreasEditor } from './AreaSheet';
import { TaskEditor } from './TaskEditor';
import type { AppView } from './AppLayout';

/** ecranul principal: personajul, cu laturile de dezvoltare în jurul lui */
export function HomeView({ go, openSettings, openStats }: { go: (v: AppView) => void; openSettings: () => void; openStats: () => void }) {
  const { state, derived, today, now } = useApp();
  const c = state.character!;
  const [attr, setAttr] = useState<AttributeKey | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [editAreas, setEditAreas] = useState(false);
  const [edit, setEdit] = useState<{ task?: Task; attrs?: AttributeKey[] } | null>(null);
  const items = useMemo(() => tasksForDay(state, today, { today }), [state, today]);
  const doneN = items.filter((i) => i.completion).length;
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


      {/* personajul și laturile lui */}
      <section className="orbit" aria-label="Personajul și laturile de dezvoltare">
        <div className="orbit-ring" />
        <div className="orbit-center">
          <ProfileAvatar name={c.name} color={c.color} size={128} />
          <b className="orbit-name">{c.name.split(' ')[0]}</b>
          <span className="orbit-title">
            {fmt(derived.level.total)} XP pe {ATTRIBUTES.length} laturi
          </span>
        </div>
        {ATTRIBUTES.map((a, i) => {
          const l = derived.attributes[a.key];
          const angle = (i / ATTRIBUTES.length) * Math.PI * 2 - Math.PI / 2;
          const watch = activeMetrics(state, a.key).some((m) => metricStatus(m, latestMetric(state, m.key)) === 'watch');
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
      <div className="orbit-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => setEditAreas(true)}>
          <SlidersHorizontal size={14} /> Editează laturile
        </button>
        <span className="muted tiny">Atinge o latură ca să-i vezi și să-i gestionezi sarcinile.</span>
      </div>

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
            <BarChart3 size={20} />
          </span>
          <span className="grow">
            <b>Statistici</b>
            <small>{fmt(derived.level.total)} XP total · {lei(derived.available * state.settings.leiPerCredit)} în portofel</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>

      {attr && (
        <AreaSheet
          attr={attr}
          onClose={() => setAttr(null)}
          onOpenTask={(id) => (setAttr(null), setItem(id))}
          onEditTask={(t) => (setAttr(null), setEdit(t ? { task: t } : { attrs: [attr] }))}
        />
      )}
      {editAreas && <AreasEditor onClose={() => setEditAreas(false)} />}
      {item && <ItemSheet id={item} onClose={() => setItem(null)} onEdit={(t) => setEdit({ task: t })} />}
      {edit && <TaskEditor task={edit.task} defaultAttributes={edit.attrs} onClose={() => setEdit(null)} />}
    </div>
  );
}
