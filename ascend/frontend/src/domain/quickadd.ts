import { addDays, dateKey } from './dates';
import type { Schedule, TaskKind } from './types';

/**
 * Interpretează un rând scris liber, de ex.:
 *   „Sală luni miercuri vineri 18:00 30p”
 *   „Dentist mâine 15:30”
 *   „Plată chirie lunar pe 5”
 *   „Alergare de 2 ori pe săptămână”
 *   „Citit zilnic 20 pct”
 *   „Trezire L-V 7:00” (reper cu oră)
 */
export interface QuickParse {
  title: string;
  schedule: Schedule;
  time?: string;
  points?: number;
  kind: TaskKind;
  /** ce a fost recunoscut, pentru afișare */
  recognized: string[];
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DAY_WORDS: [RegExp, number][] = [
  [/^(luni|lu|l)$/, 1],
  [/^(marti|ma)$/, 2],
  [/^(miercuri|mi|mie)$/, 3],
  [/^(joi|jo|j)$/, 4],
  [/^(vineri|vi|vin|v)$/, 5],
  [/^(sambata|sa|sam|s)$/, 6],
  [/^(duminica|du|dum|d)$/, 0],
];
const DAY_NAMES = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

export function parseQuick(input: string, today: string): QuickParse {
  let text = ` ${input.trim()} `;
  const rec: string[] = [];
  let schedule: Schedule = { kind: 'daily', days: [] };
  let scheduled = false;
  let time: string | undefined;
  let points: number | undefined;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = strip(text).match(re);
    if (!m || m.index === undefined) return;
    if (fn(m) === false) return;
    text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
  };

  // puncte: 30p, 30 pct, 30 puncte, +30
  take(/\s\+?(\d{1,4})\s?(p|pct|puncte)(?=\s)|\s\+(\d{1,4})(?=\s)/, (m) => {
    points = Number(m[1] ?? m[3]);
    rec.push(`${points} puncte`);
  });
  // ora: 18:00, 7.30, la 18
  // „18:00” e oră; „7.30” e oră doar după „la” (altfel „20.11” e dată)
  take(/\s(la\s(ora\s)?([01]?\d|2[0-3])[:.]([0-5]\d)|([01]?\d|2[0-3]):([0-5]\d))(?=\s)/, (m) => {
    time = m[3] ? `${m[3].padStart(2, '0')}:${m[4]}` : `${m[5].padStart(2, '0')}:${m[6]}`;
  });
  if (!time) take(/\sla\s(ora\s)?([01]?\d|2[0-3])(?=\s)/, (m) => void (time = `${m[2].padStart(2, '0')}:00`));
  if (time) rec.push(`ora ${time}`);

  // lunar pe 15
  take(/\s(lunar|in fiecare luna)(\s(pe|in|la)\s(\d{1,2}))?(?=\s)/, (m) => {
    const day = m[4] ? Number(m[4]) : Number(today.slice(8, 10));
    schedule = { kind: 'monthly', day: Math.min(31, Math.max(1, day)) };
    scheduled = true;
    rec.push(`lunar, pe ${day}`);
  });
  // de N ori pe săptămână / Nx pe saptamana
  take(/\s(de\s)?(\d)\s?(ori|x)(\s(pe|\/)\s?(saptamana|sapt|sapt\.))?(?=\s)/, (m) => {
    const n = Math.min(7, Math.max(1, Number(m[2])));
    schedule = { kind: 'weekly', times: n };
    scheduled = true;
    rec.push(`de ${n} ori pe săptămână`);
  });
  // zilnic
  take(/\s(zilnic|in fiecare zi|in fiecare dimineata|in fiecare seara)(?=\s)/, () => {
    schedule = { kind: 'daily', days: [] };
    scheduled = true;
    rec.push('zilnic');
  });
  // weekend, L-V
  take(/\s(weekend|in weekend)(?=\s)/, () => {
    schedule = { kind: 'daily', days: [6, 0] };
    scheduled = true;
    rec.push('în weekend');
  });
  take(/\s(l-v|luni-vineri|lu-vi|in timpul saptamanii|in zilele lucratoare)(?=\s)/, () => {
    schedule = { kind: 'daily', days: [1, 2, 3, 4, 5] };
    scheduled = true;
    rec.push('luni–vineri');
  });
  // azi / mâine / poimâine
  take(/\s(azi|astazi|maine|poimaine)(?=\s)/, (m) => {
    const off = m[1].startsWith('azi') || m[1] === 'astazi' ? 0 : m[1] === 'maine' ? 1 : 2;
    const due = addDays(today, off);
    schedule = { kind: 'once', due };
    scheduled = true;
    rec.push(off === 0 ? 'azi' : off === 1 ? 'mâine' : 'poimâine');
  });
  // dată: 15.11 / 15.11.2026 / 15 noiembrie
  take(/\s(pe\s)?(\d{1,2})[./](\d{1,2})([./](\d{4}))?(?=\s)/, (m) => {
    const y = m[5] ? Number(m[5]) : Number(today.slice(0, 4));
    const d = new Date(y, Number(m[3]) - 1, Number(m[2]));
    if (d.getMonth() !== Number(m[3]) - 1) return false;
    if (!m[5] && dateKey(d) < today) d.setFullYear(y + 1);
    schedule = { kind: 'once', due: dateKey(d) };
    scheduled = true;
    rec.push(`pe ${d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`);
  });
  take(/\s(pe\s)?(\d{1,2})\s(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)(?=\s)/, (m) => {
    const mon = MONTHS.indexOf(m[3].slice(0, 3));
    const y = Number(today.slice(0, 4));
    const d = new Date(y, mon, Number(m[2]));
    if (dateKey(d) < today) d.setFullYear(y + 1);
    schedule = { kind: 'once', due: dateKey(d) };
    scheduled = true;
    rec.push(`pe ${d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`);
  });
  // zile ale săptămânii (cuvinte separate sau „L Mi V”, „luni, miercuri și vineri”)
  if (!scheduled) {
    const words = text.split(/[\s,]+/).filter(Boolean);
    const days: number[] = [];
    const keep: string[] = [];
    words.forEach((w, i) => {
      const sw = strip(w);
      const hit = DAY_WORDS.find(([re]) => re.test(sw));
      // literele singure (L, V, S, D, J) contează doar dacă mai sunt și alte zile lângă ele
      const single = sw.length === 1;
      const neighbour = [words[i - 1], words[i + 1]].some((n) => n && DAY_WORDS.some(([re]) => re.test(strip(n))) && strip(n).length > 0);
      if (hit && (!single || neighbour) && !(i === 0 && single)) days.push(hit[1]);
      else if (!(sw === 'si' && days.length)) keep.push(w);
    });
    if (days.length) {
      schedule = { kind: 'daily', days: [...new Set(days)].sort() };
      scheduled = true;
      text = keep.join(' ');
      rec.push([...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAMES[d]).join(', '));
    }
  }
  if (!scheduled) rec.push('zilnic');

  const title = text.replace(/\s+/g, ' ').replace(/^[\s,–-]+|[\s,–-]+$/g, '').trim();
  const t = strip(title);
  const kind: TaskKind = /^(mic dejun|pranz|cina|gustare|masa)/.test(t) ? 'meal' : /^(trezire|culcare|ajuns|terminat program)/.test(t) && time ? 'time' : 'task';
  return { title: title.charAt(0).toUpperCase() + title.slice(1), schedule, time, points, kind, recognized: rec };
}
