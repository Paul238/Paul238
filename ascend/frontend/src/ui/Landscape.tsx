import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Peisaj montan ilustrat: cerul urmează ora reală (zori, zi, apus, noapte),
 * iar poteca spre vârf reprezintă sarcinile zilei. Personajul (punctul luminos)
 * urcă pe măsură ce bifezi.
 */

export type Period = 'night' | 'dawn' | 'day' | 'dusk';

export function periodOf(hour: number): Period {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

const PALETTE: Record<Period, { sky: [string, string, string]; far: string; mid: string; near: string; body: string; stars: number; label: string }> = {
  night: { sky: ['#060919', '#10183a', '#2a2a5c'], far: '#1c2150', mid: '#141938', near: '#0c0f26', body: '#f3f0ff', stars: 1, label: 'Noapte' },
  dawn: { sky: ['#252a62', '#9a5a86', '#ffb07c'], far: '#6c5a8e', mid: '#493e71', near: '#2a244f', body: '#ffc58f', stars: 0.35, label: 'Zori' },
  day: { sky: ['#2c5cc2', '#6d9de6', '#d3e5fb'], far: '#7f9dd2', mid: '#4f6fae', near: '#2a3f77', body: '#fff3c9', stars: 0, label: 'Zi' },
  dusk: { sky: ['#1a1745', '#6d3470', '#ff8c5c'], far: '#5b3a6f', mid: '#3a2756', near: '#1e1737', body: '#ffb27a', stars: 0.45, label: 'Apus' },
};

// poteca în serpentine, sub creasta muntelui din față; ultimul punct = vârful
const TRAIL: [number, number][] = [
  [70, 352],
  [300, 322],
  [228, 292],
  [470, 262],
  [400, 238],
  [610, 200],
  [540, 178],
  [740, 140],
  [692, 122],
  [858, 98],
  [900, 66],
];

const SEGMENTS = (() => {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < TRAIL.length; i++) {
    const d = Math.hypot(TRAIL[i][0] - TRAIL[i - 1][0], TRAIL[i][1] - TRAIL[i - 1][1]);
    lens.push(d);
    total += d;
  }
  return { lens, total };
})();

export function pointOnTrail(f: number): [number, number] {
  let dist = Math.max(0, Math.min(1, f)) * SEGMENTS.total;
  for (let i = 0; i < SEGMENTS.lens.length; i++) {
    if (dist <= SEGMENTS.lens[i] || i === SEGMENTS.lens.length - 1) {
      const t = SEGMENTS.lens[i] ? Math.min(1, dist / SEGMENTS.lens[i]) : 0;
      const [x0, y0] = TRAIL[i];
      const [x1, y1] = TRAIL[i + 1];
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    dist -= SEGMENTS.lens[i];
  }
  return TRAIL[TRAIL.length - 1];
}

const TRAIL_D = 'M' + TRAIL.map(([x, y]) => `${x} ${y}`).join(' L');

const FAR = 'M0 232 L90 192 L170 212 L260 152 L350 186 L430 142 L520 176 L610 122 L700 162 L790 112 L880 152 L980 108 L1080 152 L1200 122 L1200 360 L0 360Z';
const MID = 'M0 272 L110 226 L210 252 L320 202 L420 242 L520 208 L640 246 L760 192 L860 232 L980 188 L1090 226 L1200 202 L1200 360 L0 360Z';
const NEAR = 'M0 360 L0 320 L140 300 L260 260 L380 225 L470 190 L560 150 L660 125 L760 95 L840 78 L900 62 L960 80 L1040 120 L1120 170 L1200 210 L1200 360Z';
const NEAR_SHADE = 'M900 62 L960 80 L1040 120 L1120 170 L1200 210 L1200 360 L1010 360 L955 210 L930 120Z';
const SNOW = 'M900 62 L930 72 L918 79 L906 74 L893 84 L880 76 L870 80 L882 71Z';

function seeded(n: number) {
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => ({ x: rnd() * 1200, y: rnd() * 210, r: 0.4 + rnd() * 1.3, d: rnd() * 4 }));
}
const STARS = seeded(90);

export interface LandscapeProps {
  hour: number;
  total: number;
  done: number;
  height?: number;
  children?: ReactNode;
  /** varianta decorativă (fără potecă), pentru ecranul de autentificare */
  decorative?: boolean;
}

export function Landscape({ hour, total, done, height = 320, children, decorative }: LandscapeProps) {
  const period = periodOf(hour);
  const pal = PALETTE[period];
  const progress = total > 0 ? done / total : 0;
  const [cx, cy] = pointOnTrail(progress);
  const reached = total > 0 && done >= total;

  // soarele între 5 și 21, luna în rest; traiectorie în arc
  const body = useMemo(() => {
    const isSun = hour >= 5 && hour < 21;
    const t = isSun ? (hour - 5) / 16 : (((hour - 21 + 24) % 24) / 8);
    // arcul e în jumătatea dreaptă a cerului, ca să nu acopere textul
    return { isSun, x: 990 + t * 300, y: 230 - Math.sin(Math.PI * t) * 175 };
  }, [hour]);

  const checkpoints = useMemo(() => {
    const n = Math.min(total, 14);
    return Array.from({ length: n }, (_, i) => {
      const f = (i + 1) / n;
      return { f, p: pointOnTrail(f), done: f <= progress + 1e-6 };
    });
  }, [total, progress]);

  const id = `ls-${period}`;

  // „camera”: pe ecrane înguste arătăm porțiunea de traseu unde se află personajul
  const wrap = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(4);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAspect(e.contentRect.width / Math.max(1, e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const viewW = Math.min(1200, 360 * aspect);
  // varianta decorativă (panouri înalte): munții jos, cer înstelat deasupra
  const tall = decorative && aspect < 1.6;
  const x0 = viewW >= 1200 ? 0 : Math.max(0, Math.min(1200 - viewW, decorative ? 900 - viewW * 0.5 : cx - viewW * 0.32));

  return (
    <div
      className={`landscape ${tall && pal.stars > 0 ? 'starry' : ''}`}
      style={{ height, background: tall ? `linear-gradient(180deg, ${pal.sky[0]}, ${pal.sky[0]})` : undefined }}
      ref={wrap}
    >
      <svg
        viewBox={tall ? '420 0 780 360' : viewW >= 1200 ? '0 0 1200 360' : `${x0.toFixed(1)} 0 ${viewW.toFixed(1)} 360`}
        preserveAspectRatio={tall ? 'xMaxYMax meet' : viewW >= 1200 ? 'xMidYMax slice' : 'xMinYMax slice'}
        className="landscape-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.sky[0]} />
            <stop offset="0.6" stopColor={pal.sky[1]} />
            <stop offset="1" stopColor={pal.sky[2]} />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor={pal.body} stopOpacity="0.55" />
            <stop offset="1" stopColor={pal.body} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trail-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff6a5b" />
            <stop offset="0.55" stopColor="#ff9a4d" />
            <stop offset="1" stopColor="#ffd36b" />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </linearGradient>
          <filter id="soft-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <mask id={`${id}-moon`}>
            <rect width="1200" height="360" fill="#fff" />
            <circle cx={body.x + 9} cy={body.y - 6} r="17" fill="#000" />
          </mask>
        </defs>

        <rect width="1200" height="360" fill={`url(#${id}-sky)`} />

        {pal.stars > 0 && (
          <g opacity={pal.stars}>
            {STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className={i % 3 === 0 ? 'twinkle' : undefined} style={{ animationDelay: `${s.d}s` }} />
            ))}
          </g>
        )}

        <circle cx={body.x} cy={body.y} r="110" fill={`url(#${id}-glow)`} />
        {body.isSun ? (
          <circle cx={body.x} cy={body.y} r="22" fill={pal.body} />
        ) : (
          <circle cx={body.x} cy={body.y} r="19" fill={pal.body} mask={`url(#${id}-moon)`} />
        )}

        {(period === 'day' || period === 'dawn') && (
          <g filter="url(#soft-blur)" opacity={period === 'day' ? 0.75 : 0.45} className="clouds">
            <ellipse cx="260" cy="90" rx="120" ry="18" fill="#fff" />
            <ellipse cx="330" cy="78" rx="70" ry="16" fill="#fff" />
            <ellipse cx="760" cy="60" rx="140" ry="16" fill="#fff" />
            <ellipse cx="1060" cy="110" rx="90" ry="14" fill="#fff" />
          </g>
        )}

        <path d={FAR} fill={pal.far} opacity="0.9" />
        <rect y="150" width="1200" height="120" fill={pal.sky[2]} opacity="0.12" filter="url(#soft-blur)" />
        <path d={MID} fill={pal.mid} />
        <path d={NEAR} fill={pal.near} />
        <path d={NEAR_SHADE} fill="#000" opacity="0.22" />
        <path d={SNOW} fill="#fff" opacity={period === 'night' ? 0.55 : 0.88} />

        {!decorative && (
          <g>
            <path d={TRAIL_D} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={TRAIL_D}
              fill="none"
              stroke="url(#trail-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - progress}
              filter="url(#glow)"
              className="trail-progress"
            />
            {checkpoints.map((c, i) => (
              <circle
                key={i}
                cx={c.p[0]}
                cy={c.p[1]}
                r={c.done ? 4.5 : 3.5}
                fill={c.done ? '#ffd36b' : pal.near}
                stroke={c.done ? '#fff' : 'rgba(255,255,255,.55)'}
                strokeWidth="1.5"
                className={c.done ? 'cp-done' : undefined}
              />
            ))}
            {/* steagul de pe vârf */}
            <g transform="translate(900 62)">
              <line x1="0" y1="0" x2="0" y2="-34" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />
              <path d="M0 -34 L24 -27 L0 -20Z" fill={reached ? '#ffd36b' : 'rgba(255,255,255,.25)'} className={reached ? 'flag-wave' : undefined} />
            </g>
            {/* personajul */}
            <g className="climber" style={{ transform: `translate(${cx}px, ${cy}px)` }}>
              <circle r="16" fill="#ffd36b" opacity="0.25" className="climber-pulse" />
              <circle r="7.5" fill="#fff" filter="url(#glow)" />
              <circle r="3.5" fill="#ff7a59" />
            </g>
          </g>
        )}

        <rect width="1200" height="360" fill={`url(#${id}-fade)`} />
      </svg>
      {children && <div className="landscape-content">{children}</div>}
    </div>
  );
}

export function periodLabel(hour: number) {
  return PALETTE[periodOf(hour)].label;
}
