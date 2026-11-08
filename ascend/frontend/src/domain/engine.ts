import { ATTRIBUTE_KEYS, emptyAttributeRecord } from './attributes';
import { addDays, addHours, dateKey, daysBetween, keyOf, weekStart, weekday } from './dates';
import { attrXpToNext, charXpToNext, levelFromXp, type LevelInfo } from './leveling';
import { dueAutoPayments, guessCategory, occurrenceDate, paidTx, type Recurring, type Transaction } from './money';
import type { ShoppingItem } from './shopping';
import { DEFAULT_METRICS_ON, METRIC_XP, metricDef, plausibleMetric, type MetricEntry } from './metrics';
import { dayTotals, evaluateTime, hhmmOf, mealScore, nutritionScore, plausibleFood, sumFoods, targetsFor } from './nutrition';
import type {
  AppState,
  AreasConfig,
  CustomMetric,
  CustomFood,
  DayResult,
  FoodEntry,
  AttributeKey,
  Character,
  Completion,
  DateKey,
  Goal,
  GoalMode,
  LedgerEntry,
  Settings,
  Task,
} from './types';

/* ------------------------------------------------------------------ */
/* Stare inițială                                                      */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS: Settings = {
  leiPerCredit: 1,
  cooldownHours: { shopping: 48, development: 0, leisure: 12 },
  theme: 'system',
};

export function createEmptyState(): AppState {
  return {
    version: 1,
    character: null,
    tasks: [],
    completions: [],
    ledger: [],
    goals: [],
    xpGrants: [],
    meals: [],
    foods: [],
    metrics: [],
    shopping: [],
    transactions: [],
    recurring: [],
    days: {},
    settings: { ...DEFAULT_SETTINGS, cooldownHours: { ...DEFAULT_SETTINGS.cooldownHours } },
    customMetrics: [],
    areas: { hidden: [], custom: [] },
    meta: { dismissed: [] },
  };
}

/** completează câmpuri lipsă din date salvate de versiuni mai vechi */
export function normalizeState(raw: Partial<AppState>): AppState {
  const base = createEmptyState();
  const out: AppState = {
    ...base,
    ...raw,
    // curăță intrările imposibile (ex. 100 kg dintr-un aliment, din cauza unei tastări greșite)
    meals: (raw.meals ?? []).map((m) => ({ ...m, foods: m.foods.filter((f) => plausibleFood(f)) })),
    foods: raw.foods ?? [],
    metrics: raw.metrics ?? [],
    shopping: (raw.shopping ?? []).map((i) => ({ ...i, category: i.category ?? guessCategory(i.title, 'shopping') })),
    transactions: raw.transactions ?? [],
    recurring: raw.recurring ?? [],
    days: raw.days ?? {},
    settings: {
      ...base.settings,
      ...(raw.settings ?? {}),
      cooldownHours: { ...base.settings.cooldownHours, ...(raw.settings?.cooldownHours ?? {}) },
    },
    customMetrics: raw.customMetrics ?? [],
    areas: { hidden: raw.areas?.hidden ?? [], custom: raw.areas?.custom ?? [] },
    meta: { dismissed: raw.meta?.dismissed ?? [] },
    version: 1,
  };
  // câmpuri din versiuni vechi, la care am renunțat (provocări bonus, serii, realizări)
  const legacy = out as unknown as Record<string, unknown>;
  delete legacy.bonuses;
  const st = out.settings as unknown as Record<string, unknown>;
  for (const k of ['bonusFrequency', 'bonusMultiplier', 'bonusWindowHours', 'streakBonus', 'restDays']) delete st[k];
  return withSystemTasks(out);
}

/* ------------------------------------------------------------------ */
/* Sarcina de sistem: evidența banilor                                 */
/* ------------------------------------------------------------------ */

export const MONEY_TASK_ID = 'sys-money';
export const MONEY_TASK_POINTS = 10;

export function moneyTask(createdAt: string): Task {
  return {
    id: MONEY_TASK_ID,
    title: 'Evidența banilor',
    notes: 'Se bifează singură când notezi o cheltuială, o plată sau un produs cumpărat.',
    points: MONEY_TASK_POINTS,
    attributes: ['finance'],
    schedule: { kind: 'daily', days: [] },
    archived: false,
    createdAt,
  };
}

/** sarcina de sistem „Evidența banilor”: se adaugă dacă lipsește; dacă o arhivezi, nu mai revine */
function withSystemTasks(state: AppState, createdAt?: string): AppState {
  if (!state.character) return state;
  // de acum înainte (altfel calendarul le-ar arăta ca ratate în zilele trecute)
  const created = createdAt ?? new Date().toISOString();
  let tasks = state.tasks;
  if (!tasks.some((t) => t.id === MONEY_TASK_ID)) tasks = [...tasks, moneyTask(created)];
  return tasks === state.tasks ? state : { ...state, tasks };
}

/** ce părți se pot reseta din „Pornește de la zero” */
export interface ResetParts {
  /** bifări, credite, XP, zile închise */
  progress: boolean;
  goals: boolean;
  /** măsurători și mese */
  health: boolean;
  /** cheltuieli, venituri, plăți recurente, listă de cumpărături */
  money: boolean;
  /** sarcinile din program */
  program: boolean;
}

export function resetState(state: AppState, parts: ResetParts): AppState {
  const next: AppState = { ...state };
  if (parts.progress) Object.assign(next, { completions: [], ledger: [], xpGrants: [], days: {} });
  if (parts.goals) next.goals = [];
  else if (parts.progress) next.goals = state.goals.map((g) => ({ ...g, saved: 0 }));
  if (parts.health) Object.assign(next, { metrics: [], meals: [] });
  if (parts.money) Object.assign(next, { transactions: [], shopping: [], recurring: [] });
  if (parts.program) next.tasks = [];
  return withSystemTasks(next);
}

/* ------------------------------------------------------------------ */
/* Selectori                                                           */
/* ------------------------------------------------------------------ */

export function completionsOn(state: AppState, date: DateKey): Completion[] {
  return state.completions.filter((c) => c.date === date);
}

export function isCompletedOn(state: AppState, taskId: string, date: DateKey): boolean {
  return state.completions.some((c) => c.taskId === taskId && c.date === date);
}

export function weekCount(state: AppState, taskId: string, date: DateKey): number {
  const start = weekStart(date);
  const end = addDays(start, 6);
  return state.completions.filter((c) => c.taskId === taskId && c.date >= start && c.date <= end).length;
}

export function isOnceDone(state: AppState, task: Task): boolean {
  return task.schedule.kind === 'once' && state.completions.some((c) => c.taskId === task.id);
}

/** ziua lunii în care cade o sarcină lunară (31 → ultima zi a lunilor scurte) */
function monthlyDayFor(day: number, date: DateKey) {
  const [y, m] = date.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Math.min(Math.max(1, day), last);
}

export function isScheduledOn(task: Task, date: DateKey): boolean {
  if (task.extra?.includes(date)) return true;
  const s = task.schedule;
  if (s.kind === 'daily') return s.days.length === 0 || s.days.includes(weekday(date));
  if (s.kind === 'monthly') return Number(date.slice(8, 10)) === monthlyDayFor(s.day, date);
  if (s.kind === 'once') return !s.due || s.due === date;
  return true; // săptămânal flexibil: oricând în săptămână
}

export type TodayStatus = 'todo' | 'done';

export interface TodayItem {
  task: Task;
  status: TodayStatus;
  completion?: Completion;
  /** pentru sarcinile săptămânale */
  weekProgress?: { done: number; target: number };
  /** sarcină cu dată care a trecut și n-a fost făcută (apare azi ca restanță) */
  overdue?: boolean;
}

/**
 * Sarcinile relevante pentru ziua dată.
 * Cu `today` = ziua dată, sarcinile o-singură-dată trecute și nefăcute apar ca restanțe.
 */
export function tasksForDay(state: AppState, date: DateKey, opts: { today?: DateKey } = {}): TodayItem[] {
  const items: TodayItem[] = [];
  for (const task of state.tasks) {
    if (task.archived) continue;
    const completion = state.completions.find((c) => c.taskId === task.id && c.date === date);
    if (!completion && keyOf(task.createdAt) > date) continue; // nu exista încă
    if (!completion && task.skip?.includes(date)) continue; // sărită doar în ziua asta
    const s = task.schedule;
    if (!completion && task.extra?.includes(date)) {
      items.push({ task, status: 'todo' });
      continue;
    }
    if (s.kind === 'weekly') {
      const done = weekCount(state, task.id, date);
      if (done >= s.times && !completion) continue;
      items.push({ task, status: completion ? 'done' : 'todo', completion, weekProgress: { done, target: s.times } });
      continue;
    }
    if (s.kind === 'once') {
      if (!completion && isOnceDone(state, task)) continue;
      const overdue = !completion && !!s.due && s.due < date && opts.today === date;
      if (!completion && s.due && s.due !== date && !overdue) continue;
      items.push({ task, status: completion ? 'done' : 'todo', completion, overdue });
      continue;
    }
    if (!completion && !isScheduledOn(task, date)) continue;
    items.push({ task, status: completion ? 'done' : 'todo', completion });
  }
  return items;
}

export type PlanStatus = 'done' | 'missed' | 'planned' | 'skipped';

/** ce apare în calendar într-o zi: sarcinile flexibile apar doar în ziua în care le-ai făcut */
export function calendarDay(state: AppState, date: DateKey, today: DateKey): { item: TodayItem; status: PlanStatus }[] {
  const skipped = state.tasks
    .filter((t) => !t.archived && t.skip?.includes(date) && t.schedule.kind !== 'weekly' && isScheduledOn(t, date))
    .map((task) => ({ item: { task, status: 'todo' as const }, status: 'skipped' as PlanStatus }));
  return tasksForDay(state, date, { today })
    .filter((i) => i.completion || i.task.extra?.includes(date) || (i.task.schedule.kind !== 'weekly' && !(i.task.schedule.kind === 'once' && !i.task.schedule.due)))
    .map((item) => ({
      item,
      status: (item.completion ? (item.completion.success === false ? 'missed' : 'done') : date < today ? 'missed' : 'planned') as PlanStatus,
    }))
    .concat(skipped)
    .sort((a, b) => (a.item.task.time ?? '99').localeCompare(b.item.task.time ?? '99'));
}

export function availableCredits(state: AppState): number {
  return state.ledger.reduce((sum, e) => sum + e.amount, 0);
}

export function savedInGoals(state: AppState): number {
  return state.goals.filter((g) => g.status === 'active' || g.status === 'reflecting').reduce((s, g) => s + g.saved, 0);
}

export function totalEarned(state: AppState): number {
  return state.completions.reduce((s, c) => s + c.credits, 0);
}

export function creditsOn(state: AppState, date: DateKey): number {
  return completionsOn(state, date).reduce((s, c) => s + c.credits, 0);
}

/** media de credite pe zi în ultimele `days` zile (inclusiv azi) */
export function averageDailyCredits(state: AppState, today: DateKey, days = 14): number {
  const from = addDays(today, -(days - 1));
  const sum = state.completions.filter((c) => c.date >= from && c.date <= today).reduce((s, c) => s + c.credits, 0);
  // dacă contul e mai nou decât fereastra, împărțim la zilele reale
  const created = state.character ? keyOf(state.character.createdAt) : from;
  const effective = Math.max(1, Math.min(days, daysBetween(created > from ? created : from, today) + 1));
  return sum / effective;
}

export function goalRequiredCredits(goal: Goal, settings: Settings): number {
  return Math.max(1, Math.ceil(goal.price / Math.max(0.0001, settings.leiPerCredit)));
}

/** progresul unui obiectiv: rezervarea lui + tot ce ai disponibil în portofel (comun tuturor obiectivelor) */
export function goalProgress(state: AppState, goal: Goal) {
  const required = goalRequiredCredits(goal, state.settings);
  const have = Math.min(required, goal.saved + Math.max(0, availableCredits(state)));
  const missing = required - have;
  return { required, have, missing, ratio: have / required, affordable: missing <= 0 };
}

/** plan spre termen: câte zile mai sunt, câte credite pe zi îți trebuie și dacă ritmul tău ajunge */
export function goalDeadlinePlan(state: AppState, goal: Goal, today: DateKey) {
  if (!goal.deadline) return null;
  const { missing } = goalProgress(state, goal);
  const daysLeft = daysBetween(today, goal.deadline);
  const pace = averageDailyCredits(state, today);
  const perDay = daysLeft > 0 ? Math.ceil(missing / daysLeft) : missing;
  const status: 'done' | 'overdue' | 'onTrack' | 'behind' =
    missing <= 0 ? 'done' : daysLeft < 0 ? 'overdue' : pace >= perDay ? 'onTrack' : 'behind';
  return { daysLeft, perDay, pace, status, missing };
}

/* ---------- XP și niveluri ---------- */

export function attributeXp(state: AppState): Record<AttributeKey, number> {
  const xp = emptyAttributeRecord();
  for (const c of state.completions) for (const [k, v] of Object.entries(c.xp)) xp[k as AttributeKey] = (xp[k as AttributeKey] ?? 0) + (v ?? 0);
  for (const g of state.xpGrants) xp[g.attribute] = (xp[g.attribute] ?? 0) + g.amount;
  return xp;
}

export function attributeLevels(state: AppState): Record<AttributeKey, LevelInfo> {
  const xp = attributeXp(state);
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, levelFromXp(xp[k], attrXpToNext)])) as Record<
    AttributeKey,
    LevelInfo
  >;
}

export function characterLevel(state: AppState): LevelInfo {
  const xp = attributeXp(state);
  const total = ATTRIBUTE_KEYS.reduce((s, k) => s + xp[k], 0);
  return levelFromXp(total, charXpToNext);
}

export function xpForTask(task: Task, multiplier: number): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {};
  task.attributes.forEach((a, i) => {
    out[a] = Math.round(task.points * multiplier * (i === 0 ? 1 : 0.5));
  });
  return out;
}

/** ultimele alimente folosite (unice după nume), cu ultima cantitate */
export function recentFoods(state: AppState, limit = 8): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  const logs = [...state.meals].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const m of logs) {
    for (const f of [...m.foods].reverse()) {
      const k = f.name.toLowerCase();
      if (seen.has(k) || !plausibleFood(f)) continue;
      seen.add(k);
      out.push(f);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** ultima dată (înainte de `date`) când ai notat masa respectivă */
export function previousMeal(state: AppState, taskId: string, date: DateKey) {
  return [...state.meals]
    .filter((m) => m.taskId === taskId && m.date < date && m.foods.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/** ce primești dacă bifezi sarcina acum (pentru previzualizare) */
export function previewReward(_state: AppState, task: Task, _now?: string) {
  return { credits: task.points, xp: xpForTask(task, 1) };
}

/* ------------------------------------------------------------------ */
/* Acțiuni                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'onboard'; character: Character; tasks: Task[]; goals: Goal[]; settings: Partial<Settings> }
  | { type: 'character/update'; patch: Partial<Character> }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'task/save'; task: Task }
  | { type: 'task/archive'; id: string; archived: boolean }
  | { type: 'task/delete'; id: string }
  | { type: 'task/skipDate'; id: string; date: DateKey; skip: boolean }
  | { type: 'task/extraDate'; id: string; date: DateKey; add: boolean }
  | { type: 'metric/add'; entry: MetricEntry; grantId: string }
  | { type: 'metric/delete'; id: string }
  | { type: 'shop/add'; item: ShoppingItem }
  | { type: 'shop/buy'; id: string; now: string; cost?: number }
  | { type: 'shop/unbuy'; id: string }
  | { type: 'shop/update'; id: string; patch: Partial<Pick<ShoppingItem, 'title' | 'qty' | 'cost' | 'category'>> }
  | { type: 'shop/delete'; id: string }
  | { type: 'tx/add'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'rec/save'; rec: Recurring }
  | { type: 'rec/delete'; id: string }
  | { type: 'rec/pay'; id: string; month: string; now: string; txId: string; amount?: number }
  | { type: 'rec/unpay'; id: string; month: string }
  | { type: 'rec/extra'; id: string; amount: number; now: string; txId: string }
  | { type: 'money/autopost'; today: DateKey; now: string; seed: string }
  | { type: 'task/complete'; taskId: string; now: string; id: string; value?: string }
  | { type: 'meal/addFood'; date: DateKey; taskId: string; food: FoodEntry; logId: string }
  | { type: 'meal/removeFood'; date: DateKey; taskId: string; foodId: string }
  | { type: 'food/save'; food: CustomFood }
  | { type: 'food/delete'; id: string }
  | { type: 'day/close'; date: DateKey; now: string; seed: string }
  | { type: 'day/autoclose'; today: DateKey; now: string; seed: string }
  | { type: 'completion/undo'; id: string; now: string; entryId: string }
  | { type: 'goal/create'; goal: Omit<Goal, 'status' | 'saved' | 'activatesAt'> }
  | { type: 'goal/update'; id: string; patch: Partial<Pick<Goal, 'title' | 'price' | 'reason' | 'url' | 'attribute' | 'mode' | 'deadline'>> }
  | { type: 'goal/confirm'; id: string; now: string }
  | { type: 'goal/allocate'; id: string; amount: number; now: string; entryId: string }
  | { type: 'goal/release'; id: string; amount: number; now: string; entryId: string }
  | { type: 'goal/purchase'; id: string; now: string; entryId: string; grantId: string; price?: number }
  | { type: 'goal/reprice'; id: string; price: number; now: string; entryId: string }
  | { type: 'goal/abandon'; id: string; now: string; entryId: string }
  | { type: 'goal/rate'; id: string; rating: number }
  | { type: 'goal/delete'; id: string; now: string; entryId: string }
  | { type: 'meta/dismiss'; id: string; restore?: boolean }
  | { type: 'meta/restoreAll' }
  | { type: 'metric/toggle'; key: string; on: boolean }
  | { type: 'metric/custom'; metric: CustomMetric }
  | { type: 'metric/customDelete'; key: string }
  | { type: 'area/add'; area: AreasConfig['custom'][number] }
  | { type: 'area/update'; key: AttributeKey; patch: Partial<Omit<AreasConfig['custom'][number], 'key'>> }
  | { type: 'area/hide'; key: AttributeKey; hidden: boolean }
  | { type: 'money/checkin'; now: string }
  | { type: 'state/reset'; parts: ResetParts }
  | { type: 'state/replace'; state: AppState };

function ledger(entry: LedgerEntry, state: AppState): LedgerEntry[] {
  return [...state.ledger, entry];
}

function updateGoal(state: AppState, id: string, fn: (g: Goal) => Goal): Goal[] {
  return state.goals.map((g) => (g.id === id ? fn(g) : g));
}

export function cooldownFor(settings: Settings, mode: GoalMode): number {
  return Math.max(0, settings.cooldownHours[mode] ?? 0);
}

/** momentul unei acțiuni prin care ai gestionat banii (pentru bifarea automată) */
function moneyMoment(action: Action): string | undefined {
  switch (action.type) {
    case 'money/checkin':
    case 'shop/buy':
    case 'rec/pay':
    case 'rec/extra':
      return action.now;
    case 'tx/add':
      return action.tx.at;
    default:
      return undefined;
  }
  return undefined;
}

export function reducer(state: AppState, action: Action): AppState {
  const next = baseReducer(state, action);
  const at = moneyMoment(action);
  if (!at || (next === state && action.type !== 'money/checkin')) return next;
  // ai ținut evidența banilor azi → „Evidența banilor” se bifează singură
  return baseReducer(next, { type: 'task/complete', taskId: MONEY_TASK_ID, now: at, id: `money-${keyOf(at)}` });
}

function baseReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'onboard':
      return withSystemTasks({
        ...state,
        character: action.character,
        tasks: [...state.tasks, ...action.tasks],
        goals: [...state.goals, ...action.goals],
        settings: { ...state.settings, ...action.settings },
      }, action.character.createdAt);

    case 'character/update':
      return state.character ? { ...state, character: { ...state.character, ...action.patch } } : state;

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'task/save': {
      const exists = state.tasks.some((t) => t.id === action.task.id);
      return {
        ...state,
        tasks: exists ? state.tasks.map((t) => (t.id === action.task.id ? action.task : t)) : [...state.tasks, action.task],
      };
    }

    case 'task/archive':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, archived: action.archived } : t)) };

    case 'metric/add': {
      const def = metricDef(state, action.entry.metric);
      if (!def || !plausibleMetric(def, action.entry.value, action.entry.value2)) return state;
      const firstToday = !state.metrics.some((e) => e.metric === action.entry.metric && e.date === action.entry.date);
      return {
        ...state,
        metrics: [...state.metrics, action.entry],
        xpGrants: firstToday
          ? [...state.xpGrants, { id: action.grantId, at: action.entry.at, attribute: def.attribute, amount: METRIC_XP, label: `Măsurătoare: ${def.label}` }]
          : state.xpGrants,
      };
    }

    case 'shop/add':
      return action.item.title.trim() ? { ...state, shopping: [...state.shopping, { ...action.item, title: action.item.title.trim() }] } : state;

    case 'shop/buy':
      return {
        ...state,
        shopping: state.shopping.map((i) =>
          i.id === action.id
            ? { ...i, boughtAt: action.now, boughtDate: keyOf(action.now), cost: action.cost !== undefined && action.cost >= 0 && action.cost < 1_000_000 ? action.cost : i.cost }
            : i,
        ),
      };

    case 'shop/unbuy':
      return { ...state, shopping: state.shopping.map((i) => (i.id === action.id ? { ...i, boughtAt: undefined, boughtDate: undefined } : i)) };

    case 'shop/update':
      return { ...state, shopping: state.shopping.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)) };

    case 'tx/add':
      return action.tx.amount > 0 && action.tx.amount < 100_000_000 && action.tx.title.trim() ? { ...state, transactions: [...state.transactions, action.tx] } : state;

    case 'tx/delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };

    case 'rec/save': {
      const exists = state.recurring.some((r) => r.id === action.rec.id);
      return { ...state, recurring: exists ? state.recurring.map((r) => (r.id === action.rec.id ? action.rec : r)) : [...state.recurring, action.rec] };
    }

    case 'rec/delete':
      // arhivăm, ca istoricul plăților să rămână
      return { ...state, recurring: state.recurring.map((r) => (r.id === action.id ? { ...r, archived: true } : r)) };

    case 'rec/pay': {
      const r = state.recurring.find((x) => x.id === action.id);
      const date = r && occurrenceDate(r, action.month);
      if (!r || !date || paidTx(state, r, action.month)) return state;
      const today = keyOf(action.now);
      return {
        ...state,
        transactions: [
          ...state.transactions,
          { id: action.txId, type: r.type, title: r.title, amount: action.amount ?? r.amount, category: r.category, date: date < today ? date : today, at: action.now, recurringId: r.id, month: action.month },
        ],
      };
    }

    case 'rec/extra': {
      const r = state.recurring.find((x) => x.id === action.id);
      if (!r || !(action.amount > 0)) return state;
      const date = keyOf(action.now);
      return {
        ...state,
        transactions: [
          ...state.transactions,
          { id: action.txId, type: 'expense', title: `${r.title} · plată în avans`, amount: action.amount, category: r.category, date, at: action.now, recurringId: r.id, month: date.slice(0, 7), extra: true },
        ],
      };
    }

    case 'rec/unpay':
      return { ...state, transactions: state.transactions.filter((t) => !(t.recurringId === action.id && t.month === action.month && !t.extra)) };

    case 'money/autopost': {
      const due = dueAutoPayments(state, action.today);
      if (!due.length) return state;
      return {
        ...state,
        transactions: [
          ...state.transactions,
          ...due.map(({ r, month, date }, i) => ({ id: `${action.seed}-${i}`, type: r.type, title: r.title, amount: r.amount, category: r.category, date, at: `${date}T09:00:00.000Z`, recurringId: r.id, month })),
        ],
      };
    }

    case 'shop/delete':
      return { ...state, shopping: state.shopping.filter((i) => i.id !== action.id) };

    case 'metric/delete':
      return { ...state, metrics: state.metrics.filter((e) => e.id !== action.id) };

    case 'task/extraDate':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                extra: action.add ? [...new Set([...(t.extra ?? []), action.date])] : (t.extra ?? []).filter((d) => d !== action.date),
                skip: action.add ? (t.skip ?? []).filter((d) => d !== action.date) : t.skip,
              }
            : t,
        ),
      };

    case 'task/skipDate':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, skip: action.skip ? [...new Set([...(t.skip ?? []), action.date])] : (t.skip ?? []).filter((d) => d !== action.date) }
            : t,
        ),
      };

    case 'task/delete':
      // istoricul (completările) rămâne, doar sarcina dispare
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
      };

    case 'task/complete': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task || task.archived) return state;
      const date = keyOf(action.now);
      if (isCompletedOn(state, task.id, date) || isOnceDone(state, task)) return state;
      if (task.schedule.kind === 'weekly' && weekCount(state, task.id, date) >= task.schedule.times) return state;

      // reperele cu oră aduc puncte doar dacă ora a fost respectată
      let value: string | undefined;
      let success: boolean | undefined;
      if (task.kind === 'time' && task.time) {
        value = action.value ?? hhmmOf(action.now);
        success = evaluateTime(task.time, task.timeMode ?? 'by', task.tolerance ?? 0, value).success;
      }
      let earned = success === false ? 0 : 1;
      // mesele cu țintă: mai puține credite dacă ai depășit caloriile sau macro
      let score: number | undefined;
      if (task.kind === 'meal') {
        const log = state.meals.find((m) => m.date === date && m.taskId === task.id);
        const r = mealScore(sumFoods(log?.foods ?? []), task.target);
        if (r) earned = score = r.score;
      }
      const credits = Math.round(task.points * earned);
      const completion: Completion = {
        id: action.id,
        taskId: task.id,
        taskTitle: task.title,
        date,
        at: action.now,
        points: task.points,
        credits,
        xp: earned ? xpForTask(task, earned) : {},
        value,
        success,
        score,
      };
      return {
        ...state,
        completions: [...state.completions, completion],
        ledger: ledger(
          {
            id: `l-${action.id}`,
            at: action.now,
            amount: credits,
            kind: 'earn',
            label: value ? `${task.title} · ${value}${success ? '' : ' (ratat)'}` : score !== undefined ? `${task.title} · încadrare ${Math.round(score * 100)}%` : task.title,
            ref: completion.id,
          },
          state,
        ),
      };
    }

    case 'completion/undo': {
      const c = state.completions.find((x) => x.id === action.id);
      if (!c || c.date !== keyOf(action.now)) return state;
      return {
        ...state,
        completions: state.completions.filter((x) => x.id !== c.id),
        ledger: ledger(
          { id: action.entryId, at: action.now, amount: -c.credits, kind: 'reversal', label: `Anulat: ${c.taskTitle}`, ref: c.id },
          state,
        ),
      };
    }

    case 'goal/create': {
      const cooldown = cooldownFor(state.settings, action.goal.mode);
      const goal: Goal = {
        ...action.goal,
        saved: 0,
        status: cooldown > 0 ? 'reflecting' : 'active',
        activatesAt: addHours(action.goal.createdAt, cooldown),
      };
      return { ...state, goals: [...state.goals, goal] };
    }

    case 'goal/update':
      return { ...state, goals: updateGoal(state, action.id, (g) => ({ ...g, ...action.patch })) };

    case 'goal/confirm':
      return {
        ...state,
        goals: updateGoal(state, action.id, (g) =>
          g.status === 'reflecting' && g.activatesAt <= action.now ? { ...g, status: 'active' } : g,
        ),
      };

    case 'goal/allocate': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal || goal.status !== 'active') return state;
      const room = goalRequiredCredits(goal, state.settings) - goal.saved;
      const amount = Math.floor(Math.min(action.amount, availableCredits(state), room));
      if (amount <= 0) return state;
      return {
        ...state,
        goals: updateGoal(state, goal.id, (g) => ({ ...g, saved: g.saved + amount })),
        ledger: ledger({ id: action.entryId, at: action.now, amount: -amount, kind: 'allocate', label: `Alocat: ${goal.title}`, ref: goal.id }, state),
      };
    }

    case 'goal/release': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal || (goal.status !== 'active' && goal.status !== 'reflecting')) return state;
      const amount = Math.floor(Math.min(action.amount, goal.saved));
      if (amount <= 0) return state;
      return {
        ...state,
        goals: updateGoal(state, goal.id, (g) => ({ ...g, saved: g.saved - amount })),
        ledger: ledger({ id: action.entryId, at: action.now, amount, kind: 'release', label: `Retras: ${goal.title}`, ref: goal.id }, state),
      };
    }

    case 'goal/purchase': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal || goal.status !== 'active') return state;
      // prețul real poate fi diferit de cel estimat (ex. reducere)
      const paidPrice = action.price && action.price > 0 ? action.price : goal.price;
      const required = goalRequiredCredits({ ...goal, price: paidPrice }, state.settings);
      // creditele vin întâi din rezervarea obiectivului, restul automat din portofel
      const fromWallet = Math.max(0, required - goal.saved);
      if (fromWallet > availableCredits(state)) return state;
      const surplus = Math.max(0, goal.saved - required);
      let next: AppState = {
        ...state,
        goals: updateGoal(state, goal.id, (g) => ({ ...g, saved: required, status: 'purchased', purchasedAt: action.now, closedAt: action.now, paidPrice, paidCredits: required })),
      };
      if (surplus > 0) {
        next = { ...next, ledger: ledger({ id: action.entryId, at: action.now, amount: surplus, kind: 'release', label: `Surplus: ${goal.title}`, ref: goal.id }, next) };
      }
      if (fromWallet > 0) {
        next = { ...next, ledger: ledger({ id: `${action.entryId}-s`, at: action.now, amount: -fromWallet, kind: 'spend', label: `Achiziție: ${goal.title}`, ref: goal.id }, next) };
      }
      if (goal.mode === 'development' && goal.attribute) {
        next = {
          ...next,
          xpGrants: [
            ...next.xpGrants,
            { id: action.grantId, at: action.now, attribute: goal.attribute, amount: developmentXp(required), label: `Investiție: ${goal.title}` },
          ],
        };
      }
      return next;
    }

    case 'goal/reprice': {
      // corectarea prețului unei achiziții: diferența se returnează sau se scade din portofel
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal || goal.status !== 'purchased' || !(action.price > 0)) return state;
      const before = goal.paidCredits ?? goalRequiredCredits(goal, state.settings);
      const after = goalRequiredCredits({ ...goal, price: action.price }, state.settings);
      const diff = after - before;
      if (diff > availableCredits(state)) return state;
      return {
        ...state,
        goals: updateGoal(state, goal.id, (g) => ({ ...g, paidPrice: action.price, paidCredits: after, saved: after })),
        ledger:
          diff !== 0
            ? ledger({ id: action.entryId, at: action.now, amount: -diff, kind: 'adjust', label: `Preț corectat: ${goal.title}`, ref: goal.id }, state)
            : state.ledger,
      };
    }

    case 'goal/abandon':
    case 'goal/delete': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal) return state;
      const refundable = goal.status === 'active' || goal.status === 'reflecting' ? goal.saved : 0;
      const goals =
        action.type === 'goal/delete'
          ? state.goals.filter((g) => g.id !== goal.id)
          : updateGoal(state, goal.id, (g) => ({ ...g, status: 'abandoned', saved: 0, closedAt: action.now }));
      return {
        ...state,
        goals,
        ledger:
          refundable > 0
            ? ledger({ id: action.entryId, at: action.now, amount: refundable, kind: 'release', label: `Eliberat: ${goal.title}`, ref: goal.id }, state)
            : state.ledger,
      };
    }

    case 'goal/rate':
      return { ...state, goals: updateGoal(state, action.id, (g) => ({ ...g, rating: action.rating })) };

    case 'meal/addFood': {
      if (!plausibleFood(action.food)) return state;
      const existing = state.meals.find((m) => m.date === action.date && m.taskId === action.taskId);
      return {
        ...state,
        meals: existing
          ? state.meals.map((m) => (m === existing ? { ...m, foods: [...m.foods, action.food] } : m))
          : [...state.meals, { id: action.logId, date: action.date, taskId: action.taskId, foods: [action.food] }],
      };
    }

    case 'meal/removeFood':
      return {
        ...state,
        meals: state.meals.map((m) =>
          m.date === action.date && m.taskId === action.taskId ? { ...m, foods: m.foods.filter((f) => f.id !== action.foodId) } : m,
        ),
      };

    case 'food/save': {
      const exists = state.foods.some((f) => f.id === action.food.id || f.name.toLowerCase() === action.food.name.toLowerCase());
      return {
        ...state,
        foods: exists
          ? state.foods.map((f) => (f.id === action.food.id || f.name.toLowerCase() === action.food.name.toLowerCase() ? { ...action.food, id: f.id } : f))
          : [...state.foods, action.food],
      };
    }

    case 'food/delete':
      return { ...state, foods: state.foods.filter((f) => f.id !== action.id) };

    case 'day/close':
      return closeDay(state, action.date, action.now, action.seed);

    case 'day/autoclose': {
      const pending = [...new Set(state.meals.filter((m) => m.date < action.today && m.foods.length).map((m) => m.date))].filter(
        (d) => !state.days[d],
      );
      return pending.reduce((st, d) => closeDay(st, d, action.now, `${action.seed}-${d}`), state);
    }

    case 'meta/dismiss': {
      const set = new Set(state.meta.dismissed);
      if (action.restore) set.delete(action.id);
      else set.add(action.id);
      return { ...state, meta: { ...state.meta, dismissed: [...set] } };
    }

    case 'money/checkin':
      return state;

    case 'metric/toggle': {
      const on = new Set(state.metricsOn ?? DEFAULT_METRICS_ON);
      if (action.on) on.add(action.key);
      else on.delete(action.key);
      return { ...state, metricsOn: [...on] };
    }

    case 'metric/custom':
      return action.metric.label.trim() && !state.customMetrics.some((m) => m.key === action.metric.key)
        ? { ...state, customMetrics: [...state.customMetrics, { ...action.metric, label: action.metric.label.trim() }] }
        : state;

    case 'metric/customDelete':
      return { ...state, customMetrics: state.customMetrics.filter((m) => m.key !== action.key) };

    case 'area/add':
      return action.area.label.trim() && !state.areas.custom.some((a) => a.key === action.area.key)
        ? { ...state, areas: { ...state.areas, custom: [...state.areas.custom, { ...action.area, label: action.area.label.trim() }] } }
        : state;

    case 'area/update':
      return { ...state, areas: { ...state.areas, custom: state.areas.custom.map((a) => (a.key === action.key ? { ...a, ...action.patch } : a)) } };

    case 'area/hide': {
      const hidden = new Set(state.areas.hidden);
      if (action.hidden) hidden.add(action.key);
      else hidden.delete(action.key);
      return { ...state, areas: { ...state.areas, hidden: [...hidden] } };
    }

    case 'state/reset':
      return resetState(state, action.parts);

    case 'meta/restoreAll':
      return { ...state, meta: { ...state.meta, dismissed: [] } };

    case 'state/replace':
      return normalizeState(action.state);
  }
}

/** încheie ziua: evaluează nutriția (dacă există mese notate și un profil) și acordă creditele */
export function closeDay(state: AppState, date: DateKey, now: string, seed: string): AppState {
  if (state.days[date]) return state;
  const profile = state.settings.nutrition;
  const hasMeals = state.meals.some((m) => m.date === date && m.foods.length > 0);
  const result: DayResult = { closedAt: now };
  let next: AppState = state;
  // mesele cu țintă proprie se punctează la bifare; scorul zilei rămâne doar pentru cine nu le folosește
  const perMeal = state.tasks.some((t) => t.kind === 'meal' && !t.archived && mealScore({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, t.target));
  if (profile && hasMeals && !perMeal) {
    const totals = dayTotals(state, date);
    const targets = targetsFor(profile);
    const { score } = nutritionScore(totals, targets);
    const credits = Math.round(profile.points * score);
    result.nutrition = { totals, targets, score, credits };
    if (credits > 0) {
      const label = `Nutriție ${date.split('-').reverse().slice(0, 2).join('.')} · scor ${Math.round(score * 100)}%`;
      next = {
        ...next,
        ledger: [...next.ledger, { id: `l-${seed}`, at: now, amount: credits, kind: 'earn', label, ref: `day-${date}` }],
        xpGrants: [...next.xpGrants, { id: `x-${seed}`, at: now, attribute: 'health', amount: credits, label }],
      };
    }
  }
  return { ...next, days: { ...next.days, [date]: result } };
}

export function developmentXp(requiredCredits: number): number {
  return Math.min(500, Math.max(20, Math.round(requiredCredits * 0.1)));
}

/* ---------- utilitare pentru UI ---------- */

export function todayKey(): DateKey {
  return dateKey(new Date());
}

const DAY_NAMES = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

export function scheduleLabel(task: Task): string {
  const s = task.schedule;
  if (s.kind === 'weekly') return `${s.times}× pe săptămână, când vrei`;
  if (s.kind === 'monthly') return `Lunar, pe ${s.day}`;
  if (s.kind === 'once') {
    if (!s.due) return 'O dată, când poți';
    const d = new Date(Number(s.due.slice(0, 4)), Number(s.due.slice(5, 7)) - 1, Number(s.due.slice(8, 10)));
    return `O dată · ${d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  }
  const days = [...s.days].sort();
  if (days.length === 0 || days.length === 7) return 'Zilnic';
  if (days.join() === '1,2,3,4,5') return 'Luni–Vineri';
  if (days.join() === '0,6') return 'Weekend';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
}
