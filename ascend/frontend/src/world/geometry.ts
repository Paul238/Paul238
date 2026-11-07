/**
 * Geometria lumii (coordonate „de hartă”: 1600 × 900).
 * Muntele central = ziua de azi; vârfurile din depărtare = obiectivele;
 * taberele din vale = atributele.
 */
import type { AttributeKey } from '../domain/types';

export const WORLD_W = 1600;
export const WORLD_H = 900;

export const SUMMIT: [number, number] = [800, 262];
export const BASE: [number, number] = [800, 742];

/** silueta muntelui central */
export const MAIN_MOUNTAIN =
  'M330 800 L455 690 L520 640 L585 585 L640 520 L700 430 L748 340 L800 262 L846 330 L905 405 L960 470 L1030 560 L1105 640 L1180 700 L1290 800 Z';
export const MAIN_SHADE = 'M800 262 L846 330 L905 405 L960 470 L1030 560 L1105 640 L1180 700 L1290 800 L960 800 L900 560 L850 400 Z';
export const MAIN_SNOW = 'M800 262 L826 300 L812 296 L800 312 L787 298 L770 306 Z';

/** jumătatea de lățime a muntelui la înălțimea y (pentru serpentine) */
function halfWidth(y: number) {
  const t = (y - SUMMIT[1]) / (800 - SUMMIT[1]);
  return Math.max(0, t) * 430;
}

/** poteca în serpentine de la tabăra de bază până pe vârf */
export const TRAIL: [number, number][] = (() => {
  const pts: [number, number][] = [BASE];
  const turns = 8;
  for (let i = 1; i <= turns; i++) {
    const y = BASE[1] - ((BASE[1] - 300) * i) / turns;
    const w = halfWidth(y) * 0.62;
    pts.push([SUMMIT[0] + (i % 2 ? -w : w), y]);
  }
  pts.push([SUMMIT[0], SUMMIT[1] + 8]);
  return pts;
})();

const SEG = (() => {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < TRAIL.length; i++) {
    const d = Math.hypot(TRAIL[i][0] - TRAIL[i - 1][0], TRAIL[i][1] - TRAIL[i - 1][1]);
    lens.push(d);
    total += d;
  }
  return { lens, total };
})();

export function trailPoint(f: number): [number, number] {
  let dist = Math.max(0, Math.min(1, f)) * SEG.total;
  for (let i = 0; i < SEG.lens.length; i++) {
    if (dist <= SEG.lens[i] || i === SEG.lens.length - 1) {
      const t = SEG.lens[i] ? Math.min(1, dist / SEG.lens[i]) : 0;
      const [x0, y0] = TRAIL[i];
      const [x1, y1] = TRAIL[i + 1];
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    dist -= SEG.lens[i];
  }
  return TRAIL[TRAIL.length - 1];
}

export const TRAIL_D = 'M' + TRAIL.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');

/** poziția (fracția din potecă) a etapei i din n */
export const waypointFraction = (i: number, n: number) => (i + 1) / (n + 1);

/* ---------- vârfurile obiectivelor (în depărtare) ---------- */

export interface PeakSlot {
  x: number;
  top: number;
  w: number;
}

export const PEAK_SLOTS: PeakSlot[] = [
  { x: 470, top: 318, w: 300 },
  { x: 1140, top: 300, w: 320 },
  { x: 220, top: 372, w: 280 },
  { x: 1390, top: 360, w: 290 },
  { x: 1570, top: 420, w: 220 },
  { x: 40, top: 430, w: 220 },
];
export const PEAK_BASE = 620;

export function peakPath(s: PeakSlot, seed: number) {
  const l = s.x - s.w / 2;
  const r = s.x + s.w / 2;
  const j = (k: number) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  const sh1 = s.top + 40 + j(1) * 50;
  const sh2 = s.top + 30 + j(2) * 60;
  return `M${l} ${PEAK_BASE} L${l + s.w * 0.18} ${sh1 + 60} L${l + s.w * 0.32} ${sh1} L${s.x} ${s.top} L${r - s.w * 0.3} ${sh2} L${r - s.w * 0.16} ${sh2 + 50} L${r} ${PEAK_BASE} Z`;
}

/* ---------- taberele atributelor (în vale) ---------- */

export const CAMP_SLOTS: Record<AttributeKey, [number, number]> = {
  health: [92, 752],
  intellect: [258, 768],
  creativity: [424, 772],
  discipline: [566, 748],
  finance: [1034, 748],
  social: [1176, 772],
  order: [1342, 768],
  career: [1508, 752],
};

/* ---------- decor ---------- */

export const FAR_RANGE =
  'M0 520 L80 470 L160 500 L250 430 L330 470 L420 410 L520 460 L600 420 L700 470 L800 430 L900 470 L1000 415 L1090 455 L1190 405 L1280 450 L1380 420 L1470 460 L1600 430 L1600 640 L0 640 Z';
export const HILLS =
  'M0 690 C120 640 240 650 340 680 C430 705 520 690 600 700 L1000 700 C1080 690 1170 705 1260 680 C1360 650 1480 640 1600 690 L1600 900 L0 900 Z';
export const GROUND =
  'M0 780 C160 750 300 770 420 790 C560 812 680 800 800 800 C920 800 1040 812 1180 790 C1300 770 1440 750 1600 780 L1600 900 L0 900 Z';

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export const STARS = (() => {
  const r = seeded(9001);
  return Array.from({ length: 160 }, () => ({ x: r() * WORLD_W, y: r() * 470, r: 0.4 + r() * 1.4, d: r() * 5 }));
})();

/** pini pe dealurile din față, evitând potecile și taberele */
export const TREES = (() => {
  const r = seeded(77);
  const out: { x: number; y: number; s: number }[] = [];
  while (out.length < 46) {
    const x = r() * WORLD_W;
    const y = 700 + r() * 150;
    if (x > 520 && x < 1080 && y < 860) continue;
    if (Object.values(CAMP_SLOTS).some(([cx, cy]) => Math.abs(cx - x) < 70 && Math.abs(cy - y) < 50)) continue;
    out.push({ x, y, s: 0.6 + r() * 0.8 });
  }
  return out.sort((a, b) => a.y - b.y);
})();
