import type { DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyOf(iso: string): DateKey {
  return dateKey(new Date(iso));
}

export function parseKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** 0 = duminică ... 6 = sâmbătă */
export function weekday(k: DateKey): number {
  return parseKey(k).getDay();
}

/** luni din săptămâna zilei date */
export function weekStart(k: DateKey): DateKey {
  return addDays(k, -((weekday(k) + 6) % 7));
}

export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

export function addHours(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
}

export const WEEKDAY_SHORT = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];
/** ordinea afișării: luni → duminică */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
