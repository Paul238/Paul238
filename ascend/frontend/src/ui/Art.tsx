import { useMemo } from 'react';

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
