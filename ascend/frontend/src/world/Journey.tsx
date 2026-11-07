import {
  AlarmClock,
  BedDouble,
  Briefcase,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Coins,
  Crosshair,
  Flame,
  Gift,
  ListChecks,
  LoaderCircle,
  Plus,
  Settings,
  Sparkles,
  Sunrise,
  Target,
  UserRound,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import { activeBonus, previewReward, tasksForDay, type TodayItem } from '../domain/engine';
import { characterTitle } from '../domain/leveling';
import { dayTotals, toMinutes, targetsFor } from '../domain/nutrition';
import type { Task } from '../domain/types';
import { useApp } from '../state/store';
import { duration, fmt, greeting, longToday, plural } from '../ui/format';
import { AttrIcon } from '../ui/icons';
import { PALETTE, periodOf } from '../ui/Landscape';
import { TaskEditor } from '../views/TaskEditor';
import { Hiker } from './Hiker';
import { RoutineSetup } from './RoutineSetup';
import { BonusSheet, MealSheet, NutritionSheet, TaskSheet, TimeSheet } from './Sheets';

export type PanelId = 'tasks' | 'goals' | 'hero' | 'settings';

type SheetState = { kind: 'item'; id: string } | { kind: 'bonus' } | { kind: 'nutrition' } | null;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** culorile pământului și ale pădurii, după momentul zilei */
const LAND: Record<string, { ground: string; trees: string; hills: string }> = {
  night: { ground: '#0e1526', trees: '#0a1020', hills: '#161d3a' },
  dawn: { ground: '#3b3552', trees: '#2a2443', hills: '#4a3f6e' },
  day: { ground: '#4d7c4f', trees: '#2f5c3c', hills: '#5b86b8' },
  dusk: { ground: '#2c2342', trees: '#1d1733', hills: '#3c2b5a' },
};

/* ------------------------------------------------------------------ */
/* Utilitare pentru etape                                              */
/* ------------------------------------------------------------------ */

export function stageIcon(task: Task): LucideIcon | null {
  const t = task.title.toLowerCase();
  if (task.kind === 'meal') return Utensils;
  if (task.kind === 'time') {
    if (t.includes('trez')) return Sunrise;
    if (t.includes('culc') || t.includes('somn')) return BedDouble;
    if (t.includes('munc') || t.includes('școal') || t.includes('scoal') || t.includes('program') || t.includes('birou')) return Briefcase;
    return AlarmClock;
  }
  return null;
}

export function StageGlyph({ task, size = 20 }: { task: Task; size?: number }) {
  const Icon = stageIcon(task);
  if (Icon) return <Icon size={size} strokeWidth={2} />;
  return <AttrIcon attr={task.attributes[0] ?? 'discipline'} size={size} />;
}

export type StageStatus = 'done' | 'missed' | 'late' | 'due' | 'todo';

export function stageStatus(item: TodayItem, nowMin: number): StageStatus {
  const t = item.task;
  if (item.completion) return item.completion.success === false ? 'missed' : 'done';
  if (t.kind === 'time' && t.time && (t.timeMode ?? 'by') === 'by' && nowMin > toMinutes(t.time) + (t.tolerance ?? 0)) return 'late';
  if (t.time && nowMin > toMinutes(t.time) + 60) return 'due';
  return 'todo';
}

/* ------------------------------------------------------------------ */
/* Fundal procedural (straturi cu paralaxă)                            */
/* ------------------------------------------------------------------ */

function ridge(width: number, base: number, amp: number, step: number, seed: number, jag = 0.5) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  let d = `M0 ${base}`;
  for (let x = 0; x <= width + step; x += step) {
    const y = base - amp * (0.35 + rnd() * 0.65);
    d += ` L${x + rnd() * step * jag} ${y}`;
  }
  return d + ` L${width + step} 4000 L0 4000 Z`;
}

function trees(width: number, base: number, seed: number, scale: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: string[] = [];
  for (let x = 0; x < width; x += 26 + rnd() * 60) {
    const h = (40 + rnd() * 50) * scale;
    const w = h * 0.38;
    const y = base + rnd() * 10;
    out.push(`M${x} ${y - h} L${x + w} ${y} L${x - w} ${y} Z`);
  }
  return out.join(' ');
}

/* ------------------------------------------------------------------ */

export function Journey({ openPanel }: { openPanel: (p: PanelId) => void }) {
  const { state, today, now, derived, api, sync } = useApp();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [editor, setEditor] = useState(false);
  const [routine, setRoutine] = useState(false);
  const c = state.character!;

  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const period = periodOf(hour);
  const pal = PALETTE[period];
  const land = LAND[period];

  /* ---------- etapele zilei ---------- */
  const items = useMemo(() => tasksForDay(state, today), [state, today]);
  const byTime = (a: TodayItem, b: TodayItem) => (a.task.time ?? '99:99').localeCompare(b.task.time ?? '99:99');
  const timeline = useMemo(() => [...items].sort(byTime), [items]);
  // pe drum: întâi ce ai strâns (în ordinea în care le-ai făcut), apoi ce urmează, în ordinea orelor
  const order = useMemo(() => new Map(state.completions.map((c, i) => [c.id, i])), [state.completions]);
  const done = useMemo(() => items.filter((i) => i.completion).sort((a, b) => order.get(a.completion!.id)! - order.get(b.completion!.id)!), [items, order]);
  const pending = useMemo(() => items.filter((i) => !i.completion).sort(byTime), [items]);
  const road = [...done, ...pending];
  const n = road.length;
  const allDone = n > 0 && done.length === n;
  const bonus = activeBonus(state, now);
  const hasRoutine = state.tasks.some((t) => !t.archived && (t.kind === 'time' || t.kind === 'meal'));
  const [routineDismissed, setRoutineDismissed] = useState(() => {
    try {
      return !!localStorage.getItem('ascend.routine.dismissed');
    } catch {
      return false;
    }
  });

  /* ---------- dimensiuni și cameră ---------- */
  const sceneRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = size.w < 700;
  const SP = compact ? 150 : 210;
  const showSign = !hasRoutine && !routineDismissed;
  const START = (compact ? 230 : 330) + (showSign ? (compact ? 190 : 230) : 0);
  const groundY = size.h - (compact ? 150 : 175);
  const itemX = (i: number) => START + i * SP;
  const campX = START + n * SP + (compact ? 110 : 150);
  const roadLen = campX + (compact ? 260 : 420);
  const homeX = (compact ? 80 : 130);
  const charX = allDone ? campX - 70 : done.length > 0 ? itemX(done.length - 1) - 26 : homeX + 70;

  const [drag, setDrag] = useState(0);
  const baseCam = clamp(charX - size.w * (compact ? 0.28 : 0.3), 0, Math.max(0, roadLen - size.w));
  const cam = clamp(baseCam + drag, 0, Math.max(0, roadLen - size.w));

  // mersul: când se schimbă poziția, drumețul pornește
  const prevX = useRef(charX);
  const [walk, setWalk] = useState({ on: false, dur: 0 });
  const [justCollected, setJustCollected] = useState<string | null>(null);
  useEffect(() => {
    const dx = charX - prevX.current;
    prevX.current = charX;
    if (dx === 0) return;
    const dur = clamp(Math.abs(dx) / 240, 0.6, 2.6);
    setDrag(0);
    setWalk({ on: true, dur });
    const last = done[done.length - 1];
    if (dx > 0 && last) setJustCollected(last.task.id);
    const t1 = setTimeout(() => setWalk({ on: false, dur }), dur * 1000);
    const t2 = setTimeout(() => setJustCollected(null), dur * 1000 + 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charX]);
  const [bagBump, setBagBump] = useState(0);
  useEffect(() => {
    if (!justCollected) return;
    const t = setTimeout(() => setBagBump((b) => b + 1), walk.dur * 1000 + 650);
    return () => clearTimeout(t);
  }, [justCollected, walk.dur]);

  // tragerea pentru a privi înainte / înapoi
  const dragRef = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = dragRef.current;
      if (!g) return;
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 6) {
        g.moved = true;
        moved.current = true;
      }
      if (g.moved) setDrag(g.start - dx);
    };
    const up = () => {
      dragRef.current = null;
      setTimeout(() => (moved.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);
  const tap = (fn: () => void) => () => {
    if (!moved.current) fn();
  };

  /* ---------- fundal ---------- */
  const layers = useMemo(() => {
    const H = size.h;
    const W = roadLen + size.w;
    return {
      far: ridge(W * 0.2 + size.w, H * 0.5, H * 0.26, 140, 11, 0.6),
      mid: ridge(W * 0.45 + size.w, groundY - 70, H * 0.16, 90, 23, 0.8),
      treesFar: trees(W * 0.7 + size.w, groundY - 34, 31, 0.8),
      treesNear: trees(W * 1.25 + size.w, H + 12, 47, 0.95),
    };
  }, [size.h, size.w, roadLen, groundY]);

  const sky = useMemo(() => {
    const isSun = hour >= 5 && hour < 21;
    const t = isSun ? (hour - 5) / 16 : ((hour - 21 + 24) % 24) / 8;
    return { isSun, x: 0.08 + t * 0.84, y: 0.62 - Math.sin(Math.PI * t) * 0.5 };
  }, [hour]);

  const stars = useMemo(() => {
    let s = 5;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 90 }, () => ({ x: rnd() * 100, y: rnd() * 55, r: 0.6 + rnd() * 1.4, d: rnd() * 4 }));
  }, []);

  const trans = `transform ${walk.dur || 0.6}s cubic-bezier(.45,.05,.35,1)`;
  const layer = (speed: number) => ({ transform: `translate3d(${-cam * speed}px,0,0)`, transition: dragRef.current ? 'none' : trans });

  const next = pending[0];
  const nextLine = next ? `Următoarea: ${next.task.title}${next.task.time ? ` · ${next.task.time}` : ''}` : n ? 'Ai ajuns la tabăra de seară.' : '';
  const nutrition = state.settings.nutrition;
  const totals = dayTotals(state, today);
  const showNutri = !!nutrition || totals.kcal > 0;

  return (
    <div className={`journey ${compact ? 'compact' : ''} period-${period}`}>
      {/* ---------- cer ---------- */}
      <div className="j-sky" style={{ background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 58%, ${pal.sky[2]} 100%)` }}>
        {pal.stars > 0 &&
          stars.map((s, i) => (
            <span key={i} className={`j-star ${i % 3 === 0 ? 'twinkle' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, opacity: pal.stars, animationDelay: `${s.d}s` }} />
          ))}
        <span className="j-glow" style={{ left: `${sky.x * 100}%`, top: `${sky.y * 100}%`, background: `radial-gradient(circle, ${pal.body}88, transparent 65%)` }} />
        <span className={`j-body ${sky.isSun ? 'sun' : 'moon'}`} style={{ left: `${sky.x * 100}%`, top: `${sky.y * 100}%`, background: pal.body, ['--sky' as string]: pal.sky[1] }} />
        {(period === 'day' || period === 'dawn') && (
          <div className="j-clouds" style={{ opacity: period === 'day' ? 0.85 : 0.5 }}>
            <span style={{ left: '8%', top: '22%', width: 220 }} />
            <span style={{ left: '46%', top: '14%', width: 300 }} />
            <span style={{ left: '78%', top: '28%', width: 180 }} />
          </div>
        )}
      </div>

      {/* ---------- scena ---------- */}
      <div
        className="j-scene"
        ref={sceneRef}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragRef.current = { x: e.clientX, start: drag, moved: false };
        }}
      >
        <svg className="j-layer" style={layer(0.2)} width={roadLen * 0.2 + size.w * 1.2} height={size.h} aria-hidden="true">
          <path d={layers.far} fill={pal.far} opacity="0.75" />
        </svg>
        <div className="j-haze" style={{ top: groundY - size.h * 0.35, background: `linear-gradient(180deg, transparent, ${pal.sky[2]}33, transparent)` }} />
        <svg className="j-layer" style={layer(0.45)} width={roadLen * 0.45 + size.w * 1.2} height={size.h} aria-hidden="true">
          <path d={layers.mid} fill={land.hills} />
        </svg>
        <svg className="j-layer" style={layer(0.7)} width={roadLen * 0.7 + size.w * 1.2} height={size.h} aria-hidden="true">
          <path d={layers.treesFar} fill={land.trees} />
        </svg>

        {/* drumul și tot ce e pe el */}
        <div className="j-road" style={{ ...layer(1), width: roadLen + size.w }}>
          <div className="j-ground" style={{ top: groundY - 8, background: land.ground }} />
          <div className="j-path" style={{ top: groundY - 6, width: roadLen }} />

          {/* casa (dimineața) */}
          <div className="j-home" style={{ left: homeX - 60, top: groundY - 118 }}>
            <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
              <path d="M10 60 L60 18 L110 60 Z" fill="#8a4b3c" />
              <rect x="20" y="58" width="80" height="58" fill="#e9dcc6" />
              <rect x="50" y="80" width="20" height="36" fill="#6b4632" />
              <rect x="28" y="70" width="16" height="16" fill={period === 'night' || period === 'dusk' ? '#ffd36b' : '#9cc3e6'} />
              <rect x="76" y="70" width="16" height="16" fill={period === 'night' || period === 'dusk' ? '#ffd36b' : '#9cc3e6'} />
              <rect x="84" y="24" width="10" height="22" fill="#6b4632" />
            </svg>
            <span className="j-tag">Acasă</span>
          </div>

          {/* panou de configurare a zilei */}
          {showSign && (
            <button className="j-sign" style={{ left: homeX + (compact ? 110 : 150), top: groundY - 140 }} onClick={tap(() => setRoutine(true))}>
              <span className="j-sign-board">
                <b>Configurează-ți ziua</b>
                <small>trezire, mese, program, nutriție</small>
              </span>
              <span className="j-sign-post" />
              <span
                className="j-sign-x"
                role="button"
                aria-label="Ascunde"
                onClick={(e) => {
                  e.stopPropagation();
                  setRoutineDismissed(true);
                  try {
                    localStorage.setItem('ascend.routine.dismissed', '1');
                  } catch {
                    /* ignorat */
                  }
                }}
              >
                <X size={12} />
              </span>
            </button>
          )}

          {/* etapele */}
          {road.map((it, i) => {
            const x = itemX(i);
            const st = stageStatus(it, nowMin);
            const main = ATTRIBUTE_MAP[it.task.attributes[0] ?? 'discipline'];
            const isBonus = !!bonus?.revealed && bonus.taskId === it.task.id;
            if (it.completion) {
              const flying = justCollected === it.task.id;
              return (
                <button key={it.task.id} className={`j-post ${st}`} style={{ left: x - 30, top: groundY - 74 }} onClick={tap(() => setSheet({ kind: 'item', id: it.task.id }))}>
                  {flying && (
                    <span className="j-fly" style={{ ['--c' as string]: main.color, animationDelay: `${walk.dur}s` }}>
                      <StageGlyph task={it.task} size={22} />
                    </span>
                  )}
                  <span className="j-post-flag">{st === 'missed' ? <X size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}</span>
                  <span className="j-post-stick" />
                  <span className="j-post-label">
                    {it.task.title}
                    {it.completion.value && <i> · {it.completion.value}</i>}
                  </span>
                </button>
              );
            }
            const reward = previewReward(state, it.task, now).credits;
            return (
              <button
                key={it.task.id}
                className={`j-item ${st} ${it === next ? 'next' : ''} ${isBonus ? 'bonus' : ''}`}
                style={{ left: x - 32, top: groundY - 108, ['--c' as string]: isBonus ? '#ffd36b' : main.color }}
                onClick={tap(() => setSheet({ kind: 'item', id: it.task.id }))}
              >
                <span className="j-orb">
                  <StageGlyph task={it.task} size={compact ? 22 : 24} />
                </span>
                <span className="j-shadow" />
                <span className="j-label">
                  <b>{it.task.title}</b>
                  <small>
                    {it.task.time && <span className={st === 'late' ? 'late' : ''}>{it.task.time}</span>}
                    <span className="gold">+{reward}</span>
                  </small>
                </span>
              </button>
            );
          })}

          {/* cufărul provocării surpriză */}
          {bonus && !bonus.revealed && (
            <button
              className="j-chest"
              style={{ left: charX + (compact ? 70 : 110), top: groundY - 150 }}
              onClick={tap(() => {
                api.revealBonus(bonus.id);
                setSheet({ kind: 'bonus' });
              })}
              aria-label="Provocare surpriză"
            >
              <Gift size={26} />
              <span>Provocare surpriză</span>
            </button>
          )}

          {/* tabăra de seară */}
          <div className={`j-camp ${allDone ? 'lit' : ''}`} style={{ left: campX - 20, top: groundY - 92 }}>
            <svg viewBox="0 0 140 100" width="140" height="100" aria-hidden="true">
              <path d="M10 96 L52 20 L94 96 Z" fill="#d8693f" />
              <path d="M52 20 L94 96 L52 96 Z" fill="#000" opacity="0.2" />
              <path d="M42 96 L52 66 L62 96 Z" fill="#2b1a14" />
              <g transform="translate(116 92)">
                <path d="M-12 4 L12 -2 M-12 -2 L12 4" stroke="#6b4632" strokeWidth="4" strokeLinecap="round" />
                {allDone && (
                  <g className="campfire">
                    <path d="M0 -30 C10 -16 10 -6 0 0 C-10 -6 -10 -16 0 -30 Z" fill="#ff8a4d" />
                    <path d="M0 -18 C5 -10 5 -4 0 0 C-5 -4 -5 -10 0 -18 Z" fill="#ffd36b" />
                  </g>
                )}
              </g>
            </svg>
            <span className="j-tag">{allDone ? 'Tabăra de seară · ai ajuns!' : 'Tabăra de seară'}</span>
          </div>

          {/* drumețul */}
          <div className="j-hiker" style={{ left: charX - 40, top: groundY - 100, transition: dragRef.current ? 'none' : `left ${walk.dur || 0.6}s cubic-bezier(.45,.05,.35,1)` }}>
            <Hiker color={c.color} walking={walk.on} bag={done.length} bump={bagBump} />
          </div>
        </div>

        <svg className="j-layer j-front" style={layer(1.25)} width={roadLen * 1.25 + size.w * 1.3} height={size.h} aria-hidden="true">
          <path d={layers.treesNear} fill="#000" opacity="0.55" />
        </svg>
      </div>

      {/* ---------- HUD ---------- */}
      <header className="hud-top">
        <div className="hud-greet">
          <div className="hud-eyebrow">
            {longToday(d)} · {pal.label}
          </div>
          <h1 className="hud-title">
            {greeting(d)}, <em>{c.name.split(' ')[0]}</em>
          </h1>
          <p className="hud-sub">
            {n === 0 ? 'Niciun drum azi. Atinge + ca să adaugi o etapă.' : `${done.length} din ${n} ${plural(n, 'etapă', 'etape')} strânse în rucsac. ${nextLine}`}
          </p>
        </div>
        <div className="hud-right">
          {sync !== 'local' && (
            <span className={`hud-pill ${sync === 'offline' ? 'hud-pill-danger' : ''}`} title={sync === 'offline' ? 'Serverul nu răspunde' : sync === 'saving' ? 'Se salvează' : 'Sincronizat'}>
              {sync === 'offline' ? <CloudOff size={15} /> : sync === 'saving' ? <LoaderCircle size={15} className="spin" /> : <Cloud size={15} />}
            </span>
          )}
          <span className="hud-pill" title="Serie de zile">
            <Flame size={15} className={derived.streak.activeToday ? 'flame-on' : undefined} />
            <b className="num">{derived.streak.days}</b>
          </span>
          <button className="hud-pill hud-pill-gold" onClick={() => openPanel('goals')} title="Credite disponibile">
            <Coins size={15} />
            <b className="num">{fmt(derived.available)}</b>
          </button>
          <button className="hud-avatar" onClick={() => openPanel('hero')} title={`Nivel ${derived.level.level} · ${characterTitle(derived.level.level)}`}>
            <svg viewBox="0 0 44 44" width="44" height="44">
              <defs>
                <linearGradient id="hud-ring">
                  <stop offset="0" stopColor="#ff6a5b" />
                  <stop offset="1" stopColor="#ffd36b" />
                </linearGradient>
              </defs>
              <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
              <circle cx="22" cy="22" r="19" fill="none" stroke="url(#hud-ring)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 19 * derived.level.progress} 200`} transform="rotate(-90 22 22)" />
            </svg>
            <span style={{ background: c.color }}>{derived.level.level}</span>
          </button>
          <button className="hud-pill hud-icon" onClick={() => openPanel('settings')} aria-label="Setări">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* ---------- desfășurătorul zilei ---------- */}
      <div className="j-timeline" aria-label="Desfășurătorul zilei">
        {timeline.map((it) => {
          const st = stageStatus(it, nowMin);
          return (
            <button key={it.task.id} className={`tl-chip ${st}`} onClick={() => setSheet({ kind: 'item', id: it.task.id })} title={it.task.title}>
              <span className="tl-time">{it.task.time ?? <Clock size={12} />}</span>
              <span className="tl-icon">
                <StageGlyph task={it.task} size={14} />
              </span>
              <span className="tl-title">{it.task.title}</span>
              <span className="tl-state">
                {st === 'done' && <Check size={13} strokeWidth={3} />}
                {st === 'missed' && <X size={13} strokeWidth={3} />}
                {it.completion?.value && <i>{it.completion.value}</i>}
                {st === 'late' && <i>întârziat</i>}
              </span>
            </button>
          );
        })}
        {showNutri && (
          <button className="tl-chip tl-nutri" onClick={() => setSheet({ kind: 'nutrition' })}>
            <Utensils size={14} />
            <span className="tl-title num">
              {fmt(totals.kcal)}
              {nutrition ? ` / ${fmt(targetsFor(nutrition).kcal)}` : ''} kcal
            </span>
          </button>
        )}
        {timeline.length === 0 && <span className="tl-empty">Desfășurătorul zilei e gol.</span>}
      </div>

      {bonus?.revealed && <BonusPill expiresAt={bonus.expiresAt} title={bonus.taskTitle} mult={bonus.multiplier} onTap={() => setSheet({ kind: 'item', id: bonus.taskId })} />}

      <nav className="dock">
        <DockBtn icon={<ListChecks size={20} />} label="Sarcini" onClick={() => openPanel('tasks')} />
        <DockBtn icon={<Target size={20} />} label="Vârfuri" onClick={() => openPanel('goals')} />
        <button className="dock-plus" onClick={() => setEditor(true)} aria-label="Etapă nouă">
          <Plus size={26} strokeWidth={2.5} />
        </button>
        <DockBtn icon={<UserRound size={20} />} label="Erou" onClick={() => openPanel('hero')} />
        <DockBtn icon={<Crosshair size={20} />} label="Drumul" onClick={() => setDrag(0)} active={Math.abs(drag) < 5} />
      </nav>

      {/* ---------- foi de jos ---------- */}
      {sheet?.kind === 'item' && <ItemSheet id={sheet.id} onClose={() => setSheet(null)} onEdit={() => setEditor(true)} />}
      {sheet?.kind === 'bonus' && <BonusSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'nutrition' && <NutritionSheet onClose={() => setSheet(null)} onSetup={() => (setSheet(null), setRoutine(true))} />}
      {editor && <TaskEditor onClose={() => setEditor(false)} />}
      {routine && <RoutineSetup onClose={() => setRoutine(false)} />}
    </div>
  );
}

function ItemSheet({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: () => void }) {
  const { state } = useApp();
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return null;
  if (task.kind === 'time') return <TimeSheet taskId={id} onClose={onClose} />;
  if (task.kind === 'meal') return <MealSheet taskId={id} onClose={onClose} />;
  return <TaskSheet taskId={id} onClose={onClose} onEdit={onEdit} />;
}

function DockBtn({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button className={`dock-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BonusPill({ expiresAt, title, mult, onTap }: { expiresAt: string; title: string; mult: number; onTap: () => void }) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <button className="hud-bonus" onClick={onTap}>
      <Sparkles size={15} />
      <span className="truncate" style={{ maxWidth: 200 }}>
        {title}
      </span>
      <b>×{mult}</b>
      <span className="num hud-bonus-time">{duration(Date.parse(expiresAt) - t)}</span>
    </button>
  );
}

