import { useMemo } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import type { AttributeKey } from '../domain/types';
import { initials } from './format';

/* ------------------------------------------------------------------ */
/* Constelația atributelor: fiecare atribut e o stea care crește        */
/* și strălucește odată cu nivelul.                                      */
/* ------------------------------------------------------------------ */

const BG_STARS = (() => {
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 70 }, () => ({ x: rnd() * 440, y: rnd() * 440, r: 0.3 + rnd() * 1.1, d: rnd() * 5 }));
})();

export function Constellation({
  levels,
  progress,
  name,
  color,
  level,
  onSelect,
  selected,
}: {
  levels: Record<AttributeKey, number>;
  progress: Record<AttributeKey, number>;
  name: string;
  color: string;
  level: number;
  onSelect?: (k: AttributeKey) => void;
  selected?: AttributeKey | null;
}) {
  const C = 220;
  const maxLevel = Math.max(1, ...ATTRIBUTE_KEYS.map((k) => levels[k]));
  const nodes = ATTRIBUTE_KEYS.map((k, i) => {
    const a = (Math.PI * 2 * i) / ATTRIBUTE_KEYS.length - Math.PI / 2;
    // stelele cu nivel mai mare stau mai departe de centru: „raza de influență”
    const R = 98 + (levels[k] / maxLevel) * 40;
    return { k, a, x: C + Math.cos(a) * R, y: C + Math.sin(a) * R, lx: C + Math.cos(a) * (R + 40), ly: C + Math.sin(a) * (R + 40) };
  });
  const size = (k: AttributeKey) => 6 + Math.min(levels[k], 25) * 0.7;

  return (
    <svg viewBox="0 0 440 440" className="constellation" role="img" aria-label="Constelația atributelor">
      <defs>
        <radialGradient id="cst-core">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        {ATTRIBUTE_KEYS.map((k) => (
          <radialGradient key={k} id={`cst-${k}`}>
            <stop offset="0" stopColor={ATTRIBUTE_MAP[k].color} stopOpacity="0.7" />
            <stop offset="1" stopColor={ATTRIBUTE_MAP[k].color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {BG_STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} className={`cst-bg ${i % 4 === 0 ? 'twinkle' : ''}`} style={{ animationDelay: `${s.d}s` }} />
      ))}

      {[70, 130, 180].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" className="cst-orbit" />
      ))}

      {/* legături între stele vecine */}
      <polygon points={nodes.map((n) => `${n.x},${n.y}`).join(' ')} fill="color-mix(in srgb, var(--violet) 8%, transparent)" className="cst-link" />
      {nodes.map((n) => (
        <line key={n.k} x1={C} y1={C} x2={n.x} y2={n.y} className="cst-ray" style={{ stroke: ATTRIBUTE_MAP[n.k].color, opacity: 0.12 + (levels[n.k] / maxLevel) * 0.4 }} />
      ))}

      <circle cx={C} cy={C} r="70" fill="url(#cst-core)" />
      <circle cx={C} cy={C} r="34" fill={color} className="cst-core" />
      <text x={C} y={C - 2} textAnchor="middle" dominantBaseline="middle" className="cst-core-text">
        {initials(name)}
      </text>
      <text x={C} y={C + 17} textAnchor="middle" className="cst-core-level">
        nivel {level}
      </text>

      {nodes.map((n) => {
        const r = size(n.k);
        const a = ATTRIBUTE_MAP[n.k];
        const p = progress[n.k];
        const ringR = r + 5;
        const circ = 2 * Math.PI * ringR;
        const sel = selected === n.k;
        return (
          <g key={n.k} className={`cst-node ${sel ? 'sel' : ''}`} onClick={() => onSelect?.(n.k)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
            <circle cx={n.x} cy={n.y} r={r * 3.4} fill={`url(#cst-${n.k})`} className="cst-halo" />
            <circle cx={n.x} cy={n.y} r={ringR} fill="none" stroke={a.color} strokeOpacity="0.18" strokeWidth="2" />
            <circle
              cx={n.x}
              cy={n.y}
              r={ringR}
              fill="none"
              stroke={a.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${circ * p} ${circ}`}
              transform={`rotate(-90 ${n.x} ${n.y})`}
            />
            <circle cx={n.x} cy={n.y} r={r} fill={a.color} />
            <circle cx={n.x - r * 0.3} cy={n.y - r * 0.3} r={r * 0.35} fill="#fff" opacity="0.55" />
            <text x={n.lx} y={n.ly - 6} textAnchor="middle" className="cst-label">
              {a.label}
            </text>
            <text x={n.lx} y={n.ly + 9} textAnchor="middle" className="cst-sub">
              {levels[n.k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Explozie de particule la finalizarea unei sarcini.                   */
/* ------------------------------------------------------------------ */

export function Burst({ colors }: { colors: string[] }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        a: (360 / 14) * i + Math.random() * 18,
        d: 26 + Math.random() * 26,
        c: colors[i % colors.length],
        s: 3 + Math.random() * 3,
      })),
    [colors],
  );
  return (
    <span className="burst" aria-hidden="true">
      {parts.map((p, i) => (
        <i key={i} style={{ ['--a' as string]: `${p.a}deg`, ['--d' as string]: `${p.d}px`, background: p.c, width: p.s, height: p.s }} />
      ))}
    </span>
  );
}
