import type { AppState, AttributeKey, DateKey } from './types';

/** măsurători din viața reală, legate de laturile personajului */
export type MetricKey = 'weight' | 'waist' | 'bp' | 'pulse' | 'glucose' | 'sleep' | 'savings' | 'spending' | 'debt';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  attribute: AttributeKey;
  /** tensiunea are două valori (sistolică / diastolică) */
  pair?: [string, string];
  /** interval orientativ „în regulă” (pentru prima valoare) */
  normal?: [number, number];
  normal2?: [number, number];
  /** mai mic e mai bine (greutate la slăbire, datorii) — doar pentru afișarea tendinței */
  lowerIsBetter?: boolean;
  step: number;
  hint: string;
}

export const METRICS: MetricDef[] = [
  { key: 'weight', label: 'Greutate', unit: 'kg', attribute: 'health', step: 0.1, hint: 'dimineața, înainte de micul dejun' },
  { key: 'waist', label: 'Talie', unit: 'cm', attribute: 'health', step: 0.5, lowerIsBetter: true, hint: 'la nivelul buricului' },
  { key: 'bp', label: 'Tensiune', unit: 'mmHg', attribute: 'health', pair: ['sistolică', 'diastolică'], normal: [90, 129], normal2: [60, 84], step: 1, hint: 'în repaus, așezat' },
  { key: 'pulse', label: 'Puls în repaus', unit: 'bpm', attribute: 'health', normal: [50, 90], step: 1, hint: 'dimineața, în repaus' },
  { key: 'glucose', label: 'Glicemie', unit: 'mg/dL', attribute: 'health', normal: [70, 99], step: 1, hint: 'pe nemâncate' },
  { key: 'sleep', label: 'Somn', unit: 'ore', attribute: 'health', normal: [7, 9], step: 0.5, hint: 'noaptea trecută' },
  { key: 'savings', label: 'Economii', unit: 'lei', attribute: 'finance', step: 1, hint: 'totalul pus deoparte' },
  { key: 'spending', label: 'Cheltuieli luna aceasta', unit: 'lei', attribute: 'finance', lowerIsBetter: true, step: 1, hint: 'până acum în lună' },
  { key: 'debt', label: 'Datorii', unit: 'lei', attribute: 'finance', lowerIsBetter: true, step: 1, hint: 'credite, carduri, împrumuturi' },
];

export const METRIC_MAP = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

export interface MetricEntry {
  id: string;
  metric: MetricKey;
  date: DateKey;
  at: string;
  value: number;
  value2?: number;
  note?: string;
}

/** XP primit pentru notarea unei măsurători (o dată pe zi pe măsurătoare) */
export const METRIC_XP = 5;

export function metricsFor(attribute: AttributeKey) {
  return METRICS.filter((m) => m.attribute === attribute);
}

export function metricHistory(state: AppState, metric: MetricKey): MetricEntry[] {
  return (state.metrics ?? []).filter((e) => e.metric === metric).sort((a, b) => (a.at < b.at ? -1 : 1));
}

export function latestMetric(state: AppState, metric: MetricKey): MetricEntry | undefined {
  const h = metricHistory(state, metric);
  return h[h.length - 1];
}

export type MetricStatus = 'ok' | 'watch' | 'none';

export function metricStatus(def: MetricDef, e?: { value: number; value2?: number }): MetricStatus {
  if (!e || !def.normal) return 'none';
  const inRange = (v: number, r?: [number, number]) => !r || (v >= r[0] && v <= r[1]);
  return inRange(e.value, def.normal) && (e.value2 === undefined || inRange(e.value2, def.normal2)) ? 'ok' : 'watch';
}

export function plausibleMetric(def: MetricDef, value: number, value2?: number) {
  if (!Number.isFinite(value) || value < 0) return false;
  const max: Partial<Record<MetricKey, number>> = { weight: 400, waist: 250, bp: 260, pulse: 230, glucose: 700, sleep: 24 };
  if (max[def.key] !== undefined && value > max[def.key]!) return false;
  if (def.pair && (!Number.isFinite(value2 ?? NaN) || (value2 ?? 0) <= 0 || (value2 ?? 0) > 200)) return false;
  return true;
}
