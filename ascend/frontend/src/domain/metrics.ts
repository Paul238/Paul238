import type { AppState, AttributeKey, DateKey } from './types';

/** măsurători din viața reală, legate de laturile personajului (cheile proprii încep cu „c-”) */
export type MetricKey = string;

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
  /** propusă: nu e activă până nu o adaugi */
  extra?: boolean;
  /** definită de utilizator */
  custom?: boolean;
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
  // propuneri (cele mai urmărite în aplicațiile de sănătate, obiceiuri și buget)
  { key: 'steps', label: 'Pași', unit: 'pași', attribute: 'health', normal: [7000, 30000], step: 100, hint: 'din telefon sau ceas', extra: true },
  { key: 'water', label: 'Apă', unit: 'L', attribute: 'health', normal: [1.5, 4], step: 0.25, hint: 'cât ai băut azi', extra: true },
  { key: 'bodyfat', label: 'Grăsime corporală', unit: '%', attribute: 'health', lowerIsBetter: true, step: 0.1, hint: 'de pe cântarul inteligent', extra: true },
  { key: 'cholesterol', label: 'Colesterol total', unit: 'mg/dL', attribute: 'health', normal: [0, 199], step: 1, hint: 'din analize', extra: true },
  { key: 'mood', label: 'Stare', unit: '/10', attribute: 'discipline', normal: [6, 10], step: 1, hint: 'cum te simți azi, de la 1 la 10', extra: true },
  { key: 'screen', label: 'Timp pe telefon', unit: 'ore', attribute: 'discipline', lowerIsBetter: true, step: 0.5, hint: 'din setările telefonului', extra: true },
  { key: 'pages', label: 'Pagini citite', unit: 'pagini', attribute: 'intellect', step: 1, hint: 'azi', extra: true },
  { key: 'focus', label: 'Lucru concentrat', unit: 'ore', attribute: 'career', step: 0.5, hint: 'fără întreruperi', extra: true },
  { key: 'income', label: 'Venit lunar', unit: 'lei', attribute: 'finance', step: 1, hint: 'salariu și alte venituri', extra: true },
  { key: 'emergency', label: 'Fond de urgență', unit: 'luni', attribute: 'finance', step: 0.5, hint: 'câte luni de cheltuieli ai acoperite', extra: true },
];

/** măsurătorile active implicit (cele de la început) */
export const DEFAULT_METRICS_ON = METRICS.filter((m) => !m.extra).map((m) => m.key);

export const METRIC_MAP = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

/** definiția unei măsurători, inclusiv cele proprii */
export function metricDef(state: AppState, key: MetricKey): MetricDef | undefined {
  if (METRIC_MAP[key]) return METRIC_MAP[key];
  const c = (state.customMetrics ?? []).find((m) => m.key === key);
  return c && { key: c.key, label: c.label, unit: c.unit, attribute: c.attribute, step: c.step, hint: 'măsurătoarea ta', custom: true };
}

/** măsurătorile pe care le urmărești (implicite + adăugate + proprii) */
export function activeMetrics(state: AppState, attribute?: AttributeKey): MetricDef[] {
  const on = new Set(state.metricsOn ?? DEFAULT_METRICS_ON);
  const custom = (state.customMetrics ?? []).map((c) => metricDef(state, c.key)!);
  return [...METRICS.filter((m) => on.has(m.key)), ...custom].filter((m) => !attribute || m.attribute === attribute);
}

/** măsurători propuse pe care nu le urmărești încă */
export function suggestedMetrics(state: AppState, attribute: AttributeKey): MetricDef[] {
  const on = new Set(state.metricsOn ?? DEFAULT_METRICS_ON);
  const dismissed = new Set(state.meta?.dismissed ?? []);
  return METRICS.filter((m) => m.attribute === attribute && !on.has(m.key) && !dismissed.has(`metric:${m.key}`));
}

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
  const max: Partial<Record<MetricKey, number>> = { weight: 400, waist: 250, bp: 260, pulse: 230, glucose: 700, sleep: 24, water: 15, bodyfat: 80, mood: 10, screen: 24, focus: 24, cholesterol: 600 };
  if (value > 1_000_000_000) return false;
  if (max[def.key] !== undefined && value > max[def.key]!) return false;
  if (def.pair && (!Number.isFinite(value2 ?? NaN) || (value2 ?? 0) <= 0 || (value2 ?? 0) > 200)) return false;
  return true;
}
