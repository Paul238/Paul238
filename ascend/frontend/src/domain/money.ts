import type { AppState, DateKey, ISODate } from './types';

/* ------------------------------------------------------------------ */
/* Categorii                                                           */
/* ------------------------------------------------------------------ */

export type CategoryKey =
  | 'food'
  | 'cleaning'
  | 'hygiene'
  | 'clothes'
  | 'home'
  | 'transport'
  | 'health'
  | 'fun'
  | 'subscriptions'
  | 'loans'
  | 'rent'
  | 'other'
  | 'salary'
  | 'income-other';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  color: string;
  income?: boolean;
  /** apare în lista de cumpărături */
  shopping?: boolean;
  keywords?: RegExp;
}

const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'food',
    label: 'Alimente',
    color: '#3cc48d',
    shopping: true,
    keywords: /(lapte|paine|oua|ou\b|carne|pui|porc|vita|peste|branza|cascaval|iaurt|unt|ulei|zahar|faina|orez|paste|legume|fructe|rosii|cartofi|ceapa|mere|banane|apa|suc|cafea|ceai|ciocolata|biscuiti|salam|sunca|conserve|condimente|sare|piper|alimente|market|lidl|kaufland|carrefour|mega|profi|cumparaturi)/,
  },
  {
    key: 'cleaning',
    label: 'Curățenie și întreținere',
    color: '#35bfb2',
    shopping: true,
    keywords: /(detergent|balsam rufe|burete|lavete|mop|clor|domestos|solutie|spray|saci|pungi gunoi|hartie igienica|servetele|prosoape hartie|odorizant|degresant|tablete vase|calgon|inalbitor|bureti|perie)/,
  },
  {
    key: 'hygiene',
    label: 'Igienă și îngrijire',
    color: '#5b9dff',
    shopping: true,
    keywords: /(pasta de dinti|periuta|gel de dus|gel dus|sampon|deodorant|sapun|crema|aparate ras|spuma ras|after shave|parfum|ata dentara|apa de gura|tampoane|absorbante|scutece|demachiant|cosmetice|dr\.? max|catena)/,
  },
  {
    key: 'clothes',
    label: 'Haine și încălțăminte',
    color: '#b583f5',
    shopping: true,
    keywords: /(haine|tricou|camasa|pantaloni|blugi|geaca|jacheta|pulover|hanorac|rochie|fusta|sosete|chiloti|boxeri|lenjerie|pantofi|adidasi|ghete|cizme|papuci|curea|sapca|caciula|zara|h&m|hm\b|reserved|decathlon)/,
  },
  { key: 'home', label: 'Casă și utilități', color: '#eaa13a', shopping: true, keywords: /(curent|enel|gaz|engie|apa calda|intretinere bloc|internet|digi|orange|vodafone|telekom|mobila|ikea|dedeman|bec|veselă|vesela|oale|scule)/ },
  { key: 'transport', label: 'Transport și mașină', color: '#8f98ff', keywords: /(benzina|motorina|carburant|omv|petrom|mol|rompetrol|bilet|metrou|autobuz|taxi|uber|bolt|parcare|rovinieta|itp|rca|casco|service|revizie)/ },
  { key: 'health', label: 'Sănătate', color: '#f0706a', shopping: true, keywords: /(medicament|farmacie|vitamine|analize|dentist|doctor|consultatie|ochelari|lentile)/ },
  { key: 'fun', label: 'Ieșiri și distracție', color: '#ec6fa9', keywords: /(restaurant|pizza|bar|cafenea|cinema|film|concert|bilete|vacanta|hotel|cadou|carte|jocuri)/ },
  { key: 'subscriptions', label: 'Abonamente', color: '#9a8cff', keywords: /(netflix|spotify|youtube|hbo|disney|prime|icloud|google one|abonament|sala|gym|worldclass|7card)/ },
  { key: 'loans', label: 'Rate și credite', color: '#e5534b', keywords: /(rata|credit|imprumut|leasing|card de credit)/ },
  { key: 'rent', label: 'Chirie', color: '#c47a3a', keywords: /(chirie)/ },
  { key: 'other', label: 'Altele', color: '#8a94a6', shopping: true },
  { key: 'salary', label: 'Salariu', color: '#2fbf7a', income: true, keywords: /(salariu|leafa)/ },
  { key: 'income-other', label: 'Alte venituri', color: '#7fd6a8', income: true, keywords: /(bonus|prima|venit|freelance|dividend|chirie incasata|cadou primit)/ },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<CategoryKey, CategoryDef>;
export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => !c.income);
export const SHOPPING_CATEGORIES = CATEGORIES.filter((c) => c.shopping);
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.income);

/** ghicește categoria după nume */
export function guessCategory(title: string, kind: 'expense' | 'income' | 'shopping' = 'expense'): CategoryKey {
  const t = n(title);
  const pool = kind === 'income' ? INCOME_CATEGORIES : kind === 'shopping' ? SHOPPING_CATEGORIES : EXPENSE_CATEGORIES;
  return pool.find((c) => c.keywords?.test(t))?.key ?? (kind === 'income' ? 'income-other' : 'other');
}

/* ------------------------------------------------------------------ */
/* Tranzacții și plăți recurente                                       */
/* ------------------------------------------------------------------ */

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  category: CategoryKey;
  date: DateKey;
  at: ISODate;
  /** dacă provine dintr-o plată recurentă: id-ul ei și luna (YYYY-MM) */
  recurringId?: string;
  month?: string;
  note?: string;
  /** plată suplimentară / în avans (scade soldul unei rate) */
  extra?: boolean;
}

export interface Recurring {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  category: CategoryKey;
  /** ziua din lună (31 → ultima zi a lunilor scurte) */
  day: number;
  /** prima lună (YYYY-MM) */
  start: string;
  /** ultima lună inclusiv (pentru rate), opțional */
  end?: string;
  /** se marchează singură ca plătită în ziua ei */
  auto: boolean;
  /** pentru rate: soldul de rambursat la început (fără dobândă) */
  principal?: number;
  archived?: boolean;
}

export const monthOf = (d: DateKey) => d.slice(0, 7);

export function addMonths(month: string, k: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthsBetween(a: string, b: string) {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** data plății în luna dată (sau null dacă plata nu e activă atunci) */
export function occurrenceDate(r: Recurring, month: string): DateKey | null {
  if (r.archived || month < r.start || (r.end && month > r.end)) return null;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(Math.max(1, r.day), last)).padStart(2, '0')}`;
}

export function installmentsLeft(r: Recurring, month: string) {
  return r.end ? Math.max(0, monthsBetween(month, r.end) + 1) : null;
}

export function paidTx(state: AppState, r: Recurring, month: string) {
  return state.transactions.find((t) => t.recurringId === r.id && t.month === month && !t.extra);
}

export interface RecurringItem {
  r: Recurring;
  date: DateKey;
  tx?: Transaction;
  /** a trecut ziua plății și nu e marcată */
  overdue: boolean;
}

export function recurringForMonth(state: AppState, month: string, today: DateKey): RecurringItem[] {
  const out: RecurringItem[] = [];
  for (const r of state.recurring) {
    const date = occurrenceDate(r, month);
    if (!date) continue;
    const tx = paidTx(state, r, month);
    // o rată achitată integral nu mai apare în lunile următoare
    if (!tx && loanFinishedBefore(state, r, month, today)) continue;
    out.push({ r, date, tx, overdue: !tx && date < today });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- rate: sold, plăți în avans, câte rate mai sunt ---------- */

/** totalul plătit pe o rată (rate lunare + plăți în avans) */
export function loanPaid(state: AppState, r: Recurring) {
  return state.transactions.filter((t) => t.recurringId === r.id).reduce((s, t) => s + t.amount, 0);
}

export interface LoanStatus {
  remaining: number;
  extraPaid: number;
  /** câte rate lunare mai sunt (inclusiv luna curentă dacă nu e plătită) */
  left: number;
  /** luna ultimei rate */
  endMonth: string;
  /** cu câte luni s-a scurtat datorită plăților în avans */
  savedMonths: number;
}

/**
 * Situația unei rate cu sold cunoscut. Calcul simplificat, fără dobândă:
 * soldul scade cu fiecare plată; ratele rămase = sold / rata lunară.
 */
export function loanStatus(state: AppState, r: Recurring, today: DateKey): LoanStatus | null {
  if (!r.principal) return null;
  const paid = loanPaid(state, r);
  const extraPaid = state.transactions.filter((t) => t.recurringId === r.id && t.extra).reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, r.principal - paid);
  const left = Math.ceil(remaining / Math.max(1, r.amount));
  const now = monthOf(today);
  const thisPaid = !!paidTx(state, r, now) || occurrenceDate(r, now) === null;
  const endMonth = left === 0 ? now : addMonths(now, thisPaid ? left : left - 1);
  const savedMonths = Math.floor(extraPaid / Math.max(1, r.amount));
  return { remaining, extraPaid, left, endMonth, savedMonths };
}

function loanFinishedBefore(state: AppState, r: Recurring, month: string, today: DateKey) {
  if (!r.principal) return false;
  // soldul la începutul lunii: plățile făcute până înainte de luna respectivă
  const before = state.transactions.filter((t) => t.recurringId === r.id && t.date < `${month}-01`).reduce((s, t) => s + t.amount, 0);
  const remaining = r.principal - before;
  if (remaining <= 0) return true;
  // lunile viitoare: proiectăm ratele care urmează
  const cur = monthOf(today);
  if (month <= cur) return false;
  const thisMonthPaid = paidTx(state, r, cur) ? 0 : r.amount;
  const projected = remaining - thisMonthPaid - Math.max(0, monthsBetween(cur, month) - 1) * r.amount;
  return projected <= 0;
}

/** plățile automate scadente (până azi) care nu au încă tranzacție; cel mult 24 de luni în urmă */
export function dueAutoPayments(state: AppState, today: DateKey): { r: Recurring; month: string; date: DateKey }[] {
  const out: { r: Recurring; month: string; date: DateKey }[] = [];
  const now = monthOf(today);
  for (const r of state.recurring) {
    if (!r.auto || r.archived) continue;
    let m = r.start < addMonths(now, -24) ? addMonths(now, -24) : r.start;
    for (let i = 0; i < 30 && m <= now; i++, m = addMonths(m, 1)) {
      const date = occurrenceDate(r, m);
      if (date && date <= today && !paidTx(state, r, m) && !loanFinishedBefore(state, r, m, today)) out.push({ r, month: m, date });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sumarul lunii                                                       */
/* ------------------------------------------------------------------ */

export interface MonthSummary {
  income: number;
  expenses: number;
  left: number;
  /** venituri și plăți recurente care mai urmează luna asta */
  pendingIncome: number;
  pendingExpenses: number;
  /** cât rămâne după ce intră/ies și cele care urmează */
  projected: number;
  byCategory: { key: CategoryKey; amount: number }[];
  shopping: number;
}

export function monthSummary(state: AppState, month: string, today: DateKey): MonthSummary {
  const tx = state.transactions.filter((t) => monthOf(t.date) === month);
  const shopItems = state.shopping.filter((i) => i.boughtDate && monthOf(i.boughtDate) === month && (i.cost ?? 0) > 0);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const shopping = shopItems.reduce((s, i) => s + (i.cost ?? 0), 0);
  const expenses = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) + shopping;
  const pending = recurringForMonth(state, month, today).filter((x) => !x.tx);
  const pendingIncome = pending.filter((x) => x.r.type === 'income').reduce((s, x) => s + x.r.amount, 0);
  const pendingExpenses = pending.filter((x) => x.r.type === 'expense').reduce((s, x) => s + x.r.amount, 0);
  const cat = new Map<CategoryKey, number>();
  for (const t of tx) if (t.type === 'expense') cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount);
  for (const i of shopItems) cat.set(i.category ?? 'other', (cat.get(i.category ?? 'other') ?? 0) + (i.cost ?? 0));
  const byCategory = [...cat.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);
  const left = income - expenses;
  return { income, expenses, left, pendingIncome, pendingExpenses, projected: left + pendingIncome - pendingExpenses, byCategory, shopping };
}

/** „Haine 250”, „Salariu 5200 +”, „bon Lidl 87,5” → titlu + sumă */
export function parseMoneyLine(input: string): { title: string; amount: number | null; type: 'income' | 'expense' } {
  const m = input.match(/(-?\d+(?:[.,]\d{1,2})?)\s*(lei|ron)?\s*$/i) ?? input.match(/(\d+(?:[.,]\d{1,2})?)\s*(lei|ron)?/i);
  const amount = m ? Math.abs(Number(m[1].replace(',', '.'))) : null;
  let title = m ? (input.slice(0, m.index) + input.slice((m.index ?? 0) + m[0].length)).trim() : input.trim();
  let type: 'income' | 'expense' = 'expense';
  if (/^\+|\+\s*$/.test(title) || INCOME_CATEGORIES.some((c) => c.keywords?.test(n(title)))) type = 'income';
  title = title.replace(/^\+|\+$/g, '').replace(/^(bon|bonul)\s+/i, '').trim();
  return { title: title.charAt(0).toUpperCase() + title.slice(1), amount, type };
}
