import { ATTRIBUTE_KEYS, emptyAttributeRecord } from './attributes';
import { addDays, addHours, dateKey, daysBetween, keyOf, weekStart, weekday } from './dates';
import { attrXpToNext, charXpToNext, levelFromXp, type LevelInfo } from './leveling';
import { dayTotals, evaluateTime, hhmmOf, nutritionScore, targetsFor } from './nutrition';
import type {
  AppState,
  CustomFood,
  DayResult,
  FoodEntry,
  AttributeKey,
  BonusChallenge,
  BonusFrequency,
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
  bonusFrequency: 'normal',
  bonusMultiplier: 5,
  bonusWindowHours: 24,
  streakBonus: true,
  restDays: [],
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
    bonuses: [],
    xpGrants: [],
    meals: [],
    foods: [],
    days: {},
    settings: { ...DEFAULT_SETTINGS, cooldownHours: { ...DEFAULT_SETTINGS.cooldownHours } },
    meta: { seenAchievements: [] },
  };
}

/** completează câmpuri lipsă din date salvate de versiuni mai vechi */
export function normalizeState(raw: Partial<AppState>): AppState {
  const base = createEmptyState();
  return {
    ...base,
    ...raw,
    meals: raw.meals ?? [],
    foods: raw.foods ?? [],
    days: raw.days ?? {},
    settings: {
      ...base.settings,
      ...(raw.settings ?? {}),
      cooldownHours: { ...base.settings.cooldownHours, ...(raw.settings?.cooldownHours ?? {}) },
    },
    meta: { ...base.meta, ...(raw.meta ?? {}) },
    version: 1,
  };
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

export function isScheduledOn(task: Task, date: DateKey): boolean {
  if (task.schedule.kind !== 'daily') return true;
  const days = task.schedule.days;
  return days.length === 0 || days.includes(weekday(date));
}

export type TodayStatus = 'todo' | 'done';

export interface TodayItem {
  task: Task;
  status: TodayStatus;
  completion?: Completion;
  /** pentru sarcinile săptămânale */
  weekProgress?: { done: number; target: number };
}

/** sarcinile relevante pentru ziua dată, în ordinea de afișare */
export function tasksForDay(state: AppState, date: DateKey): TodayItem[] {
  const items: TodayItem[] = [];
  for (const task of state.tasks) {
    if (task.archived) continue;
    const completion = state.completions.find((c) => c.taskId === task.id && c.date === date);
    const s = task.schedule;
    if (s.kind === 'daily') {
      if (!isScheduledOn(task, date) && !completion) continue;
    } else if (s.kind === 'weekly') {
      const done = weekCount(state, task.id, date);
      if (done >= s.times && !completion) continue;
      items.push({ task, status: completion ? 'done' : 'todo', completion, weekProgress: { done, target: s.times } });
      continue;
    } else if (s.kind === 'once') {
      if (isOnceDone(state, task) && !completion) continue;
    }
    items.push({ task, status: completion ? 'done' : 'todo', completion });
  }
  return items;
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

/* ---------- serii (streak) ---------- */

function activeDays(state: AppState): Set<DateKey> {
  return new Set(state.completions.map((c) => c.date));
}

/** câte zile consecutive cu activitate se termină la data `end` (zilele libere nu rup seria) */
export function streakEndingAt(state: AppState, end: DateKey): number {
  const days = activeDays(state);
  const start = state.character ? keyOf(state.character.createdAt) : '0000-00-00';
  let count = 0;
  let d = end;
  for (let i = 0; i < 3660 && d >= start; i++) {
    if (days.has(d)) count++;
    else if (!state.settings.restDays.includes(weekday(d))) break;
    d = addDays(d, -1);
  }
  return count;
}

/** seria curentă: dacă azi nu ai bifat încă nimic, seria de ieri este încă vie */
export function currentStreak(state: AppState, today: DateKey): { days: number; activeToday: boolean } {
  const activeToday = state.completions.some((c) => c.date === today);
  return { days: activeToday ? streakEndingAt(state, today) : streakEndingAt(state, addDays(today, -1)), activeToday };
}

export function longestStreak(state: AppState): number {
  const days = [...activeDays(state)].sort();
  if (days.length === 0) return 0;
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of days) {
    if (prev) {
      // verifică dacă zilele dintre prev și d sunt toate libere
      let gapOk = true;
      for (let x = addDays(prev, 1); x < d; x = addDays(x, 1)) {
        if (!state.settings.restDays.includes(weekday(x))) {
          gapOk = false;
          break;
        }
      }
      run = gapOk ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function streakMultiplierFor(streakDays: number, enabled: boolean): number {
  return enabled ? 1 + Math.min(streakDays, 30) / 100 : 1;
}

/* ---------- XP și niveluri ---------- */

export function attributeXp(state: AppState): Record<AttributeKey, number> {
  const xp = emptyAttributeRecord();
  for (const c of state.completions) for (const [k, v] of Object.entries(c.xp)) xp[k as AttributeKey] += v ?? 0;
  for (const g of state.xpGrants) xp[g.attribute] += g.amount;
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

/** ce primești dacă bifezi sarcina acum (pentru previzualizare) */
export function previewReward(state: AppState, task: Task, now: string) {
  const today = keyOf(now);
  const bonus = activeBonusFor(state, task.id, now);
  const bonusMultiplier = bonus ? bonus.multiplier : 1;
  const streak = streakEndingAt(state, addDays(today, -1));
  const streakMultiplier = streakMultiplierFor(streak, state.settings.streakBonus);
  return {
    credits: Math.round(task.points * bonusMultiplier * streakMultiplier),
    xp: xpForTask(task, bonusMultiplier),
    bonusMultiplier,
    streakMultiplier,
  };
}

/* ---------- provocări bonus ---------- */

export function activeBonus(state: AppState, now: string): BonusChallenge | undefined {
  return state.bonuses.find((b) => b.status === 'active' && b.expiresAt > now);
}

export function activeBonusFor(state: AppState, taskId: string, now: string): BonusChallenge | undefined {
  const b = activeBonus(state, now);
  return b && b.taskId === taskId ? b : undefined;
}

export const BONUS_CHANCE: Record<BonusFrequency, number> = {
  off: 0,
  low: 0.3,
  normal: 0.5,
  high: 0.75,
  daily: 1,
};

/** sarcinile care pot deveni provocare acum */
export function bonusEligibleTasks(state: AppState, now: string): Task[] {
  const today = keyOf(now);
  const tomorrow = addDays(today, 1);
  return state.tasks.filter(
    (t) =>
      (t.kind ?? 'task') === 'task' &&
      t.special &&
      !t.archived &&
      !isOnceDone(state, t) &&
      !isCompletedOn(state, t.id, today) &&
      (isScheduledOn(t, today) || isScheduledOn(t, tomorrow)),
  );
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
  | { type: 'task/toggleSpecial'; id: string }
  | { type: 'task/complete'; taskId: string; now: string; id: string; value?: string }
  | { type: 'meal/addFood'; date: DateKey; taskId: string; food: FoodEntry; logId: string }
  | { type: 'meal/removeFood'; date: DateKey; taskId: string; foodId: string }
  | { type: 'food/save'; food: CustomFood }
  | { type: 'food/delete'; id: string }
  | { type: 'day/close'; date: DateKey; now: string; seed: string }
  | { type: 'day/autoclose'; today: DateKey; now: string; seed: string }
  | { type: 'completion/undo'; id: string; now: string; entryId: string }
  | { type: 'goal/create'; goal: Omit<Goal, 'status' | 'saved' | 'activatesAt'> }
  | { type: 'goal/update'; id: string; patch: Partial<Pick<Goal, 'title' | 'price' | 'reason' | 'url' | 'attribute' | 'mode'>> }
  | { type: 'goal/confirm'; id: string; now: string }
  | { type: 'goal/allocate'; id: string; amount: number; now: string; entryId: string }
  | { type: 'goal/release'; id: string; amount: number; now: string; entryId: string }
  | { type: 'goal/purchase'; id: string; now: string; entryId: string; grantId: string }
  | { type: 'goal/abandon'; id: string; now: string; entryId: string }
  | { type: 'goal/rate'; id: string; rating: number }
  | { type: 'goal/delete'; id: string; now: string; entryId: string }
  | { type: 'bonus/tick'; now: string; roll: number; dropRoll: number; pickRoll: number; id: string }
  | { type: 'bonus/reveal'; id: string }
  | { type: 'meta/seeAchievements'; ids: string[] }
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'onboard':
      return {
        ...state,
        character: action.character,
        tasks: [...state.tasks, ...action.tasks],
        goals: [...state.goals, ...action.goals],
        settings: { ...state.settings, ...action.settings },
      };

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

    case 'task/toggleSpecial':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, special: !t.special } : t)) };

    case 'task/delete':
      // istoricul (completările) rămâne, doar sarcina dispare
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        bonuses: state.bonuses.map((b) =>
          b.taskId === action.id && b.status === 'active' ? { ...b, status: 'expired' } : b,
        ),
      };

    case 'task/complete': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task || task.archived) return state;
      const date = keyOf(action.now);
      if (isCompletedOn(state, task.id, date) || isOnceDone(state, task)) return state;
      if (task.schedule.kind === 'weekly' && weekCount(state, task.id, date) >= task.schedule.times) return state;

      const bonus = activeBonusFor(state, task.id, action.now);
      const bonusMultiplier = bonus ? bonus.multiplier : 1;
      const streakMultiplier = streakMultiplierFor(streakEndingAt(state, addDays(date, -1)), state.settings.streakBonus);
      // reperele cu oră aduc puncte doar dacă ora a fost respectată
      let value: string | undefined;
      let success: boolean | undefined;
      if (task.kind === 'time' && task.time) {
        value = action.value ?? hhmmOf(action.now);
        success = evaluateTime(task.time, task.timeMode ?? 'by', task.tolerance ?? 0, value).success;
      }
      const earned = success === false ? 0 : 1;
      const credits = Math.round(task.points * bonusMultiplier * streakMultiplier) * earned;
      const completion: Completion = {
        id: action.id,
        taskId: task.id,
        taskTitle: task.title,
        date,
        at: action.now,
        points: task.points,
        bonusMultiplier,
        streakMultiplier,
        credits,
        xp: earned ? xpForTask(task, bonusMultiplier) : {},
        bonusId: bonus?.id,
        value,
        success,
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
            label: bonus ? `${task.title} · provocare ×${bonus.multiplier}` : value ? `${task.title} · ${value}${success ? '' : ' (ratat)'}` : task.title,
            ref: completion.id,
          },
          state,
        ),
        bonuses: bonus
          ? state.bonuses.map((b) => (b.id === bonus.id ? { ...b, status: 'completed', completedAt: action.now, revealed: true } : b))
          : state.bonuses,
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
        bonuses: c.bonusId
          ? state.bonuses.map((b) =>
              b.id === c.bonusId
                ? { ...b, status: b.expiresAt > action.now ? 'active' : 'expired', completedAt: undefined }
                : b,
            )
          : state.bonuses,
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
      const required = goalRequiredCredits(goal, state.settings);
      if (goal.saved < required) return state;
      const surplus = goal.saved - required;
      let next: AppState = {
        ...state,
        goals: updateGoal(state, goal.id, (g) => ({ ...g, saved: required, status: 'purchased', purchasedAt: action.now, closedAt: action.now })),
      };
      if (surplus > 0) {
        next = { ...next, ledger: ledger({ id: action.entryId, at: action.now, amount: surplus, kind: 'release', label: `Surplus: ${goal.title}`, ref: goal.id }, next) };
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

    case 'bonus/tick':
      return bonusTick(state, action);

    case 'bonus/reveal':
      return { ...state, bonuses: state.bonuses.map((b) => (b.id === action.id ? { ...b, revealed: true } : b)) };

    case 'meal/addFood': {
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

    case 'meta/seeAchievements':
      return { ...state, meta: { ...state.meta, seenAchievements: [...new Set([...state.meta.seenAchievements, ...action.ids])] } };

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
  if (profile && hasMeals) {
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

/**
 * Motorul provocărilor bonus.
 * 1. expiră provocările trecute de termen;
 * 2. o dată pe zi decide (cu probabilitatea frecvenței) dacă apare o provocare
 *    și programează un moment aleatoriu din zi (între acum și ora 21);
 * 3. când momentul a sosit, alege aleatoriu o sarcină din lista specială.
 */
function bonusTick(state: AppState, a: Extract<Action, { type: 'bonus/tick' }>): AppState {
  const now = a.now;
  const today = keyOf(now);
  let bonuses = state.bonuses.map((b) => (b.status === 'active' && b.expiresAt <= now ? { ...b, status: 'expired' as const } : b));
  let meta = state.meta;
  const hasActive = bonuses.some((b) => b.status === 'active');
  const s = state.settings;

  if (s.bonusFrequency === 'off') {
    const changed = bonuses.some((b, i) => b !== state.bonuses[i]) || meta.pendingDrop;
    return changed ? { ...state, bonuses, meta: { ...meta, pendingDrop: undefined } } : state;
  }

  // programare zilnică
  if (!meta.pendingDrop && !hasActive && meta.lastBonusRoll !== today) {
    meta = { ...meta, lastBonusRoll: today };
    if (a.roll < BONUS_CHANCE[s.bonusFrequency]) {
      const nowDate = new Date(now);
      const end = new Date(nowDate);
      end.setHours(21, 0, 0, 0);
      const span = Math.max(0, end.getTime() - nowDate.getTime());
      meta.pendingDrop = { date: today, at: new Date(nowDate.getTime() + a.dropRoll * span).toISOString() };
    }
  }

  // livrare
  if (meta.pendingDrop && !hasActive && meta.pendingDrop.at <= now) {
    const eligible = bonusEligibleTasks({ ...state, bonuses }, now);
    const last = [...bonuses].sort((x, y) => (x.assignedAt < y.assignedAt ? 1 : -1))[0];
    const pool = eligible.length > 1 && last ? eligible.filter((t) => t.id !== last.taskId) : eligible;
    meta = { ...meta, pendingDrop: undefined };
    if (pool.length > 0) {
      const task = pool[Math.min(pool.length - 1, Math.floor(a.pickRoll * pool.length))];
      bonuses = [
        ...bonuses,
        {
          id: a.id,
          taskId: task.id,
          taskTitle: task.title,
          assignedAt: now,
          expiresAt: addHours(now, s.bonusWindowHours),
          multiplier: s.bonusMultiplier,
          revealed: false,
          status: 'active',
        },
      ];
    }
  }

  const changed = meta !== state.meta || bonuses.some((b, i) => b !== state.bonuses[i]) || bonuses.length !== state.bonuses.length;
  return changed ? { ...state, bonuses, meta } : state;
}

/* ---------- utilitare pentru UI ---------- */

export function todayKey(): DateKey {
  return dateKey(new Date());
}

export function scheduleLabel(task: Task): string {
  const s = task.schedule;
  if (s.kind === 'weekly') return `${s.times}× pe săptămână`;
  if (s.kind === 'once') return s.due ? `O dată · până la ${s.due.split('-').reverse().join('.')}` : 'O singură dată';
  if (s.days.length === 0 || s.days.length === 7) return 'Zilnic';
  const names = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => names[d]).join(', ');
}
