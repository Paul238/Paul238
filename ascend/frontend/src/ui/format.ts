const nf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(Math.round(n));
export const fmt1 = (n: number) => nf1.format(n);
export const lei = (n: number) => `${nf.format(Math.round(n))} lei`;

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('ro-RO', opts);
}

export function longToday(d = new Date()) {
  const s = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Noapte bună';
  if (h < 12) return 'Bună dimineața';
  if (h < 18) return 'Bună ziua';
  return 'Bună seara';
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export function humanHours(ms: number): string {
  const h = Math.ceil(ms / 3_600_000);
  if (h <= 1) return 'sub o oră';
  if (h < 48) return `${h} ore`;
  return `${Math.ceil(h / 24)} zile`;
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

const nf2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** sumă de bani cu zecimale (ex. 13,5 lei) */
export const ron = (n: number) => `${nf2.format(Math.round(n * 100) / 100)} lei`;
