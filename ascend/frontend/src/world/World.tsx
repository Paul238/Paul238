import { Cloud, CloudOff, Coins, Crosshair, Flame, Hand, LoaderCircle, Mountain, Plus, Settings, Sparkles, Target, UserRound, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { activeBonus, goalRequiredCredits, previewReward, tasksForDay, type TodayItem } from '../domain/engine';
import { characterTitle } from '../domain/leveling';
import type { AttributeKey, Goal } from '../domain/types';
import { useApp } from '../state/store';
import { duration, fmt, greeting, initials, longToday, plural } from '../ui/format';
import { PALETTE, periodOf } from '../ui/Landscape';
import { GoalEditor } from '../views/GoalsView';
import { TaskEditor } from '../views/TaskEditor';
import {
  CAMP_SLOTS,
  FAR_RANGE,
  GROUND,
  HILLS,
  MAIN_MOUNTAIN,
  MAIN_SHADE,
  MAIN_SNOW,
  PEAK_BASE,
  PEAK_SLOTS,
  STARS,
  SUMMIT,
  TRAIL_D,
  TREES,
  WORLD_H,
  WORLD_W,
  BASE,
  peakPath,
  trailPoint,
  waypointFraction,
} from './geometry';
import { BonusSheet, CampSheet, GoalSheet, TaskSheet } from './Sheets';

export type PanelId = 'tasks' | 'goals' | 'hero' | 'settings';

type SheetState =
  | { kind: 'task'; id: string }
  | { kind: 'goal'; id: string }
  | { kind: 'camp'; key: AttributeKey }
  | { kind: 'bonus' }
  | null;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function useSecond() {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function heroLine(done: number, total: number) {
  if (total === 0) return 'Niciun traseu azi. Atinge + ca să adaugi o etapă.';
  if (done === 0) return `${total} ${plural(total, 'etapă', 'etape')} până pe vârf. Atinge prima pentru a porni.`;
  if (done < total) return `${done} din ${total} etape urcate. Mai ai ${total - done} până pe vârf.`;
  return 'Ai cucerit vârful zilei.';
}

export function World({ openPanel }: { openPanel: (p: PanelId) => void }) {
  const { state, today, now, derived, api, sync } = useApp();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [editor, setEditor] = useState<{ attrs?: AttributeKey[] } | null>(null);
  const [goalEditor, setGoalEditor] = useState(false);

  /* ---------- date ---------- */
  const items = useMemo(() => {
    const all = tasksForDay(state, today);
    const done = all.filter((i) => i.completion).sort((a, b) => (a.completion!.at < b.completion!.at ? -1 : 1));
    const todo = all.filter((i) => !i.completion);
    return [...done, ...todo];
  }, [state, today]);
  const doneCount = items.filter((i) => i.completion).length;
  const n = items.length;
  const bonus = activeBonus(state, now);
  const goals = state.goals.filter((g) => g.status === 'active' || g.status === 'reflecting').slice(0, PEAK_SLOTS.length);
  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;
  const period = periodOf(hour);
  const pal = PALETTE[period];
  const c = state.character!;

  const climberF = doneCount === 0 ? 0 : doneCount >= n ? 1 : waypointFraction(doneCount - 1, n);
  const climber = n === 0 ? BASE : trailPoint(climberF);
  const progress = n ? doneCount / n : 0;

  /* ---------- camera ---------- */
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // pe ecrane late arătăm toată lumea (cu cer în plus deasupra); pe ecrane înguste se trage harta
  // ecran îngust (telefon în portret): arătăm muntele întreg, cu cer înalt deasupra, și mărim elementele
  const compact = size.w / size.h < 1.05;
  const fitW = size.w / WORLD_W;
  const extraSky = size.h / fitW - WORLD_H;
  const scale = compact ? Math.max(size.w / 760, size.h / 1700) : extraSky >= 0 && extraSky <= 280 ? fitW : Math.max(size.h / WORLD_H, fitW);
  /** factor de mărire pentru marcaje, ca să rămână ușor de atins */
  const k = compact ? clamp(0.85 / scale, 1, 1.8) : 1;
  const visW = size.w / scale;
  const visH = size.h / scale;
  const maxX = Math.max(0, WORLD_W - visW);
  const centered = clamp((compact ? SUMMIT[0] : climber[0]) - visW / 2, 0, maxX);
  const [camX, setCamX] = useState<number | null>(null);
  const x = clamp(camX ?? centered, 0, maxX);
  // pe telefon ținem baza muntelui deasupra barei de jos (~100px)
  const camY = compact ? 850 - (size.h - 100) / scale : WORLD_H - visH;
  const drag = useRef<{ x: number; cam: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem('ascend.hint.pan');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g) return;
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 6) {
        g.moved = true;
        moved.current = true;
      }
      if (g.moved) setCamX(clamp(g.cam - dx / scale, 0, maxX));
    };
    const up = () => {
      if (drag.current?.moved && hint) {
        setHint(false);
        try {
          localStorage.setItem('ascend.hint.pan', '1');
        } catch {
          /* ignorat */
        }
      }
      drag.current = null;
      setTimeout(() => (moved.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [scale, maxX, hint]);

  /** handler de atingere care ignoră tragerea hărții */
  const tap = (fn: () => void): TapProps => ({
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!moved.current) fn();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    },
    role: 'button',
    tabIndex: 0,
    style: { cursor: 'pointer' },
  });

  const recenter = () => setCamX(null);
  const offCenter = maxX > 0 && Math.abs(x - centered) > 140;

  /* ---------- corpuri cerești ---------- */
  const body = (() => {
    const isSun = hour >= 5 && hour < 21;
    const t = isSun ? (hour - 5) / 16 : ((hour - 21 + 24) % 24) / 8;
    return { isSun, x: 120 + t * 1360, y: 470 - Math.sin(Math.PI * t) * 360 };
  })();

  const nextTodo = items.find((i) => !i.completion);

  return (
    <div className={`world ${compact ? 'compact' : ''}`} ref={wrap}>
      <svg
        className="world-svg"
        viewBox={`${x.toFixed(1)} ${camY.toFixed(1)} ${visW.toFixed(1)} ${visH.toFixed(1)}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          if (maxX > 0) drag.current = { x: e.clientX, cam: x, moved: false };
        }}
        onWheel={(e) => {
          if (maxX > 0 && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey)) setCamX(clamp(x + (e.deltaX || e.deltaY) / scale, 0, maxX));
        }}
      >
        <defs>
          <linearGradient id="w-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.sky[0]} />
            <stop offset="0.55" stopColor={pal.sky[1]} />
            <stop offset="0.8" stopColor={pal.sky[2]} />
          </linearGradient>
          <radialGradient id="w-glow">
            <stop offset="0" stopColor={pal.body} stopOpacity="0.5" />
            <stop offset="1" stopColor={pal.body} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="w-trail" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff6a5b" />
            <stop offset="0.6" stopColor="#ff9a4d" />
            <stop offset="1" stopColor="#ffd36b" />
          </linearGradient>
          <linearGradient id="w-gold" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff8a4d" />
            <stop offset="1" stopColor="#ffd36b" />
          </linearGradient>
          <linearGradient id="w-comet" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#fff6d6" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="w-fire">
            <stop offset="0" stopColor="#ffd36b" stopOpacity="0.9" />
            <stop offset="0.4" stopColor="#ff8a4d" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ff6a5b" stopOpacity="0" />
          </radialGradient>
          <filter id="w-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="w-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <mask id="w-moon">
            <rect x="0" y="0" width={WORLD_W} height={WORLD_H} fill="#fff" />
            <circle cx={body.x + 12} cy={body.y - 8} r="24" fill="#000" />
          </mask>
          {goals.map((g, i) => (
            <clipPath key={g.id} id={`w-peak-${i}`}>
              <path d={peakPath(PEAK_SLOTS[i], i + 1)} />
            </clipPath>
          ))}
        </defs>

        {/* cer */}
        <rect x="-10" y="-300" width={WORLD_W + 20} height={WORLD_H + 310} fill="url(#w-sky)" />
        {pal.stars > 0 && (
          <g opacity={pal.stars}>
            {STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className={i % 3 === 0 ? 'twinkle' : undefined} style={{ animationDelay: `${s.d}s` }} />
            ))}
          </g>
        )}
        <circle cx={body.x} cy={body.y} r="170" fill="url(#w-glow)" />
        {body.isSun ? <circle cx={body.x} cy={body.y} r="30" fill={pal.body} /> : <circle cx={body.x} cy={body.y} r="26" fill={pal.body} mask="url(#w-moon)" />}
        {(period === 'day' || period === 'dawn') && (
          <g filter="url(#w-blur)" opacity={period === 'day' ? 0.8 : 0.45} className="clouds">
            <ellipse cx="300" cy="170" rx="170" ry="24" fill="#fff" />
            <ellipse cx="380" cy="150" rx="90" ry="22" fill="#fff" />
            <ellipse cx="1060" cy="120" rx="200" ry="22" fill="#fff" />
            <ellipse cx="1420" cy="210" rx="120" ry="18" fill="#fff" />
          </g>
        )}

        {/* cometa: provocarea surpriză nedezvăluită */}
        {bonus && !bonus.revealed && (
          <g
            className="comet"
            {...tap(() => {
              api.revealBonus(bonus.id);
              setSheet({ kind: 'bonus' });
            })}
            aria-label="Provocare surpriză"
          >
            <path d="M1180 150 L1330 92 L1338 112 Z" fill="url(#w-comet)" />
            <circle cx="1180" cy="150" r="46" fill="#ffd36b" opacity="0.18" className="comet-halo" />
            <circle cx="1180" cy="150" r="13" fill="#fff6d6" filter="url(#w-soft)" />
            <g transform="translate(1180 196)">
              <rect x="-82" y="-15" width="164" height="30" rx="15" className="w-label w-label-gold" />
              <text textAnchor="middle" y="5" className="w-label-text strong">
                ✦ Provocare surpriză
              </text>
            </g>
          </g>
        )}

        {/* lanțul îndepărtat */}
        <path d={FAR_RANGE} fill={pal.far} opacity="0.55" />
        <rect x="0" y="420" width={WORLD_W} height="200" fill={pal.sky[2]} opacity="0.14" filter="url(#w-blur)" />

        {/* vârfurile obiectivelor */}
        {goals.map((g, i) => (
          <GoalPeak key={g.id} goal={g} index={i} pal={pal} k={k} onTap={tap(() => setSheet({ kind: 'goal', id: g.id }))} />
        ))}
        {goals.length === 0 && (
          <g {...tap(() => setGoalEditor(true))} className="ghost-peak">
            <path d={peakPath(PEAK_SLOTS[0], 1)} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="6 8" />
            <g transform={`translate(${PEAK_SLOTS[0].x} ${PEAK_SLOTS[0].top - 34})`}>
              <rect x="-88" y="-17" width="176" height="34" rx="17" className="w-label" />
              <text textAnchor="middle" y="5" className="w-label-text">
                + Alege un vârf
              </text>
            </g>
          </g>
        )}

        <path d={HILLS} fill={pal.mid} />

        {/* muntele zilei */}
        <path d={MAIN_MOUNTAIN} fill={pal.near} />
        <path d={MAIN_SHADE} fill="#000" opacity="0.22" />
        <path d={MAIN_SNOW} fill="#fff" opacity={period === 'night' ? 0.6 : 0.9} />

        <path d={TRAIL_D} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeDasharray="3 10" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={TRAIL_D}
          fill="none"
          stroke="url(#w-trail)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - climberF}
          filter="url(#w-soft)"
          className="trail-progress"
        />

        {/* steagul și eticheta vârfului zilei */}
        <g transform={`translate(${SUMMIT[0]} ${SUMMIT[1]})`}>
          <line x1="0" y1="0" x2="0" y2="-46" stroke="#fff" strokeWidth="2.5" strokeOpacity="0.85" />
          <path d="M0 -46 L32 -37 L0 -28Z" fill={n > 0 && doneCount >= n ? '#ffd36b' : 'rgba(255,255,255,.3)'} className={n > 0 && doneCount >= n ? 'flag-wave' : undefined} />
        </g>

        {/* etapele */}
        {items.map((it, i) => (
          <Waypoint
            key={it.task.id}
            item={it}
            index={i}
            n={n}
            isBonus={!!bonus?.revealed && bonus.taskId === it.task.id}
            isNext={nextTodo?.task.id === it.task.id}
            k={k}
            compact={compact}
            onTap={tap(() => setSheet({ kind: 'task', id: it.task.id }))}
          />
        ))}

        {/* personajul */}
        <g className="climber" style={{ transform: `translate(${climber[0]}px, ${climber[1]}px) scale(${k})` }}>
          <circle r="30" fill={c.color} opacity="0.25" className="climber-pulse" />
          <circle r="17" fill={c.color} stroke="#fff" strokeWidth="3" filter="url(#w-soft)" />
          <text textAnchor="middle" dominantBaseline="central" className="w-climber-text">
            {initials(c.name)}
          </text>
        </g>

        {/* valea */}
        <path d={GROUND} fill={pal.near} />
        <rect x="-10" y="890" width={WORLD_W + 20} height="600" fill={pal.near} />
        <path d={GROUND} fill="#000" opacity="0.25" />
        <rect x="-10" y="890" width={WORLD_W + 20} height="600" fill="#000" opacity="0.25" />
        {TREES.map((t, i) => (
          <path
            key={i}
            d={`M${t.x} ${t.y - 46 * t.s} L${t.x + 15 * t.s} ${t.y - 16 * t.s} L${t.x + 7 * t.s} ${t.y - 16 * t.s} L${t.x + 19 * t.s} ${t.y} L${t.x - 19 * t.s} ${t.y} L${t.x - 7 * t.s} ${t.y - 16 * t.s} L${t.x - 15 * t.s} ${t.y - 16 * t.s} Z`}
            fill="#000"
            opacity={0.35 + (t.y - 700) / 600}
          />
        ))}

        {/* tabăra de bază */}
        <g transform={`translate(${BASE[0]} ${BASE[1] + 30})`}>
          <path d="M-34 0 L0 -40 L34 0 Z" fill="#e9e3d6" opacity="0.9" />
          <path d="M-8 0 L0 -14 L8 0 Z" fill="#000" opacity="0.5" />
          <circle cx="46" cy="-4" r="26" fill="url(#w-fire)" className="fire" />
          <circle cx="46" cy="-4" r="5" fill="#ffd36b" />
        </g>

        {/* taberele atributelor */}
        {ATTRIBUTE_KEYS.map((a) => (
          <Camp key={a} attr={a} k={k} compact={compact} level={derived.attributes[a].level} progress={derived.attributes[a].progress} onTap={tap(() => setSheet({ kind: 'camp', key: a }))} />
        ))}
      </svg>

      {/* ---------- HUD ---------- */}
      <header className="hud-top">
        <div className="hud-greet">
          <div className="hud-eyebrow">
            {longToday(d)} · {pal.label}
          </div>
          <h1 className="hud-title">
            {greeting(d)}, <em>{c.name.split(' ')[0]}</em>
          </h1>
          <p className="hud-sub">{heroLine(doneCount, n)}</p>
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
              <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                stroke="url(#hud-ring)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 19 * derived.level.progress} 200`}
                transform="rotate(-90 22 22)"
              />
              <defs>
                <linearGradient id="hud-ring">
                  <stop offset="0" stopColor="#ff6a5b" />
                  <stop offset="1" stopColor="#ffd36b" />
                </linearGradient>
              </defs>
            </svg>
            <span style={{ background: c.color }}>{derived.level.level}</span>
          </button>
          <button className="hud-pill hud-icon" onClick={() => openPanel('settings')} aria-label="Setări">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {bonus?.revealed && <BonusPill expiresAt={bonus.expiresAt} title={bonus.taskTitle} mult={bonus.multiplier} onTap={() => setSheet({ kind: 'task', id: bonus.taskId })} />}

      <div className="hud-gauge" aria-hidden="true">
        <span className="hud-gauge-label">vârf</span>
        <div className="hud-gauge-track">
          <div className="hud-gauge-fill" style={{ height: `${progress * 100}%` }} />
        </div>
        <span className="hud-gauge-label">bază</span>
        <span className="hud-gauge-alt num">{fmt(derived.level.total)} m</span>
      </div>

      {hint && maxX > 40 && (
        <div className="hud-hint">
          <Hand size={15} /> Trage ca să explorezi lumea
        </div>
      )}

      <nav className="dock">
        <DockBtn icon={<ListChecks size={20} />} label="Sarcini" onClick={() => openPanel('tasks')} />
        <DockBtn icon={<Target size={20} />} label="Vârfuri" onClick={() => openPanel('goals')} />
        <button className="dock-plus" onClick={() => setEditor({})} aria-label="Etapă nouă">
          <Plus size={26} strokeWidth={2.5} />
        </button>
        <DockBtn icon={<UserRound size={20} />} label="Erou" onClick={() => openPanel('hero')} />
        <DockBtn icon={offCenter ? <Crosshair size={20} /> : <Mountain size={20} />} label={offCenter ? 'Centrează' : 'Lumea'} onClick={recenter} active={!offCenter} />
      </nav>

      {/* ---------- foi de jos ---------- */}
      {sheet?.kind === 'task' && <TaskSheet taskId={sheet.id} onClose={() => setSheet(null)} onEdit={(t) => setEditor({ attrs: t.attributes })} />}
      {sheet?.kind === 'goal' && <GoalSheet goalId={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'camp' && (
        <CampSheet
          attr={sheet.key}
          onClose={() => setSheet(null)}
          onAddTask={() => {
            setEditor({ attrs: [sheet.key] });
            setSheet(null);
          }}
          onOpenTask={(id) => setSheet({ kind: 'task', id })}
        />
      )}
      {sheet?.kind === 'bonus' && <BonusSheet onClose={() => setSheet(null)} />}

      {editor && <TaskEditor defaultAttributes={editor.attrs} onClose={() => setEditor(null)} />}
      {goalEditor && <GoalEditor defaultMode="shopping" onClose={() => setGoalEditor(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DockBtn({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button className={`dock-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BonusPill({ expiresAt, title, mult, onTap }: { expiresAt: string; title: string; mult: number; onTap: () => void }) {
  const t = useSecond();
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

interface TapProps {
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  role: string;
  tabIndex: number;
  style: React.CSSProperties;
}

function Waypoint({ item, index, n, isBonus, isNext, k, compact, onTap }: { item: TodayItem; index: number; n: number; isBonus: boolean; isNext: boolean; k: number; compact: boolean; onTap: TapProps }) {
  const { state, now } = useApp();
  const [x, y] = trailPoint(waypointFraction(index, n));
  const done = !!item.completion;
  const color = ATTRIBUTE_MAP[item.task.attributes[0] ?? 'discipline'].color;
  // pe telefon eticheta stă spre centrul muntelui și apare doar la etapa următoare / provocare
  const right = compact ? x < SUMMIT[0] : x >= SUMMIT[0];
  const showLabel = !compact || isNext || isBonus;
  const title = short(item.task.title, compact ? 18 : 24);
  const reward = done ? item.completion!.credits : previewReward(state, item.task, now).credits;
  const labelW = title.length * 8.1 + 70;
  const lx = right ? 26 : -26 - labelW;

  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} {...onTap} className={`wp ${done ? 'done' : ''} ${isNext ? 'next' : ''}`} aria-label={item.task.title}>
      {isBonus && <circle r="34" fill="#ffd36b" opacity="0.22" className="climber-pulse" />}
      {isNext && !isBonus && <circle r="26" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" className="wp-ring" />}
      <circle r="17" fill={done ? color : 'rgba(10,12,28,.75)'} stroke={isBonus ? '#ffd36b' : color} strokeWidth="3" />
      {done ? (
        <path d="M-7 0 L-2 5 L8 -6" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text textAnchor="middle" dominantBaseline="central" className="wp-num">
          {index + 1}
        </text>
      )}
      {showLabel && (
      <g transform={`translate(${lx} -16)`} className="wp-label">
        <rect width={labelW} height="32" rx="16" className={`w-label ${isBonus ? 'w-label-gold' : ''}`} />
        <text x="14" y="21" className={`w-label-text ${done ? 'w-done' : ''}`}>
          {title}
        </text>
        <text x={labelW - 14} y="21" textAnchor="end" className={`w-label-reward ${done ? 'w-done' : ''}`}>
          +{reward}
        </text>
      </g>
      )}
    </g>
  );
}

function GoalPeak({ goal, index, pal, k, onTap }: { goal: Goal; index: number; pal: (typeof PALETTE)['day']; k: number; onTap: TapProps }) {
  const { state } = useApp();
  const slot = PEAK_SLOTS[index];
  const required = goalRequiredCredits(goal, state.settings);
  const p = Math.min(1, goal.saved / required);
  const level = PEAK_BASE - p * (PEAK_BASE - slot.top);
  const funded = p >= 1;
  const label = `${short(goal.title, 16)} · ${Math.floor(p * 100)}%`;
  const w = label.length * 8 + 34;

  return (
    <g {...onTap} className="peak" aria-label={goal.title}>
      <path d={peakPath(slot, index + 1)} fill={pal.far} />
      <path d={peakPath(slot, index + 1)} fill="#fff" opacity="0.06" />
      <g clipPath={`url(#w-peak-${index})`}>
        <rect x={slot.x - slot.w} y={level} width={slot.w * 2} height={PEAK_BASE - level} fill="url(#w-gold)" opacity="0.9" className="peak-fill" />
        <rect x={slot.x - slot.w} y={level} width={slot.w * 2} height="3" fill="#fff" opacity="0.7" className="peak-fill" />
      </g>
      <g transform={`translate(${slot.x} ${slot.top}) scale(${k})`}>
        <line x1="0" y1="0" x2="0" y2="-28" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />
        <path d="M0 -28 L20 -22 L0 -16Z" fill={funded ? '#ffd36b' : 'rgba(255,255,255,.35)'} className={funded ? 'flag-wave' : undefined} />
        <g transform="translate(0 -54)">
          <rect x={-w / 2} y="-16" width={w} height="32" rx="16" className={`w-label ${funded ? 'w-label-gold' : ''}`} />
          <text textAnchor="middle" y="5" className="w-label-text">
            {goal.status === 'reflecting' ? '⏳ ' : ''}
            {label}
          </text>
        </g>
      </g>
    </g>
  );
}

function Camp({ attr, level, progress, k, compact, onTap }: { attr: AttributeKey; level: number; progress: number; k: number; compact: boolean; onTap: TapProps }) {
  const [x, y] = CAMP_SLOTS[attr];
  const a = ATTRIBUTE_MAP[attr];
  const fire = 14 + Math.min(level, 20) * 2.2;
  const ringC = 2 * Math.PI * 15;
  return (
    <g transform={`translate(${x} ${y}) scale(${compact ? k * 0.85 : 1})`} {...onTap} className="camp" aria-label={`${a.label}, nivel ${level}`}>
      <circle cx="40" cy="-6" r={fire} fill="url(#w-fire)" className="fire" />
      <circle cx="40" cy="-6" r="4.5" fill="#ffd36b" />
      <path d="M-32 0 L0 -44 L32 0 Z" fill={a.color} />
      <path d="M0 -44 L32 0 L0 0 Z" fill="#000" opacity="0.22" />
      <path d="M-8 0 L0 -15 L8 0 Z" fill="#000" opacity="0.55" />
      <g transform="translate(26 -46)">
        <circle r="15" fill="rgba(10,12,28,.85)" />
        <circle r="15" fill="none" stroke={a.color} strokeOpacity="0.3" strokeWidth="3" />
        <circle r="15" fill="none" stroke={a.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${ringC * progress} ${ringC}`} transform="rotate(-90)" />
        <text textAnchor="middle" dominantBaseline="central" className="camp-level">
          {level}
        </text>
      </g>
      {!compact && (
        <text y="26" textAnchor="middle" className="camp-label">
          {a.label}
        </text>
      )}
    </g>
  );
}
