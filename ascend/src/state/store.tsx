import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, unlockedAchievements } from '../domain/achievements';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { keyOf } from '../domain/dates';
import {
  activeBonus,
  attributeLevels,
  availableCredits,
  characterLevel,
  currentStreak,
  reducer,
  type Action,
} from '../domain/engine';
import { uid } from '../domain/id';
import { characterTitle } from '../domain/leveling';
import type { AppState, AttributeKey, Character, Goal, Settings, Task } from '../domain/types';
import type { Session } from '../services/auth';
import { localRepository } from '../services/storage';

export type ToastKind = 'success' | 'info' | 'level' | 'achievement' | 'bonus' | 'error';
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
}

export interface Celebration {
  level: number;
  title: string;
}

function useNow(intervalMs: number): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function createApi(dispatch: (a: Action) => void) {
  const now = () => new Date().toISOString();
  return {
    onboard: (character: Character, tasks: Task[], goals: Goal[], settings: Partial<Settings>) =>
      dispatch({ type: 'onboard', character, tasks, goals, settings }),
    updateCharacter: (patch: Partial<Character>) => dispatch({ type: 'character/update', patch }),
    updateSettings: (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch }),
    saveTask: (task: Task) => dispatch({ type: 'task/save', task }),
    archiveTask: (id: string, archived: boolean) => dispatch({ type: 'task/archive', id, archived }),
    deleteTask: (id: string) => dispatch({ type: 'task/delete', id }),
    toggleSpecial: (id: string) => dispatch({ type: 'task/toggleSpecial', id }),
    completeTask: (taskId: string) => dispatch({ type: 'task/complete', taskId, now: now(), id: uid('c') }),
    undoCompletion: (id: string) => dispatch({ type: 'completion/undo', id, now: now(), entryId: uid('l') }),
    createGoal: (goal: Omit<Goal, 'status' | 'saved' | 'activatesAt' | 'id' | 'createdAt'>) =>
      dispatch({ type: 'goal/create', goal: { ...goal, id: uid('g'), createdAt: now() } }),
    updateGoal: (id: string, patch: Extract<Action, { type: 'goal/update' }>['patch']) => dispatch({ type: 'goal/update', id, patch }),
    confirmGoal: (id: string) => dispatch({ type: 'goal/confirm', id, now: now() }),
    allocate: (id: string, amount: number) => dispatch({ type: 'goal/allocate', id, amount, now: now(), entryId: uid('l') }),
    release: (id: string, amount: number) => dispatch({ type: 'goal/release', id, amount, now: now(), entryId: uid('l') }),
    purchase: (id: string) => dispatch({ type: 'goal/purchase', id, now: now(), entryId: uid('l'), grantId: uid('x') }),
    abandonGoal: (id: string) => dispatch({ type: 'goal/abandon', id, now: now(), entryId: uid('l') }),
    deleteGoal: (id: string) => dispatch({ type: 'goal/delete', id, now: now(), entryId: uid('l') }),
    rateGoal: (id: string, rating: number) => dispatch({ type: 'goal/rate', id, rating }),
    revealBonus: (id: string) => dispatch({ type: 'bonus/reveal', id }),
    replaceState: (state: AppState) => dispatch({ type: 'state/replace', state }),
    tickBonus: () =>
      dispatch({ type: 'bonus/tick', now: now(), roll: Math.random(), dropRoll: Math.random(), pickRoll: Math.random(), id: uid('b') }),
  };
}

export type Api = ReturnType<typeof createApi>;

interface AppContextValue {
  state: AppState;
  session: Session;
  now: string;
  today: string;
  api: Api;
  derived: {
    available: number;
    streak: { days: number; activeToday: boolean };
    level: ReturnType<typeof characterLevel>;
    attributes: ReturnType<typeof attributeLevels>;
  };
  toasts: Toast[];
  notify: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  celebration: Celebration | null;
  closeCelebration: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, session.userId, (id) => localRepository.load(id));
  const now = useNow(15_000);
  const today = keyOf(now);
  const api = useMemo(() => createApi(dispatch), []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('t');
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.kind === 'error' ? 6000 : 4500);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  // persistență
  useEffect(() => {
    localRepository.save(session.userId, state);
  }, [state, session.userId]);

  // temă
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // motorul provocărilor rulează periodic
  useEffect(() => {
    if (state.character) api.tickBonus();
  }, [now, state.character, api]);

  const derived = useMemo(
    () => ({
      available: availableCredits(state),
      streak: currentStreak(state, today),
      level: characterLevel(state),
      attributes: attributeLevels(state),
    }),
    [state, today],
  );

  // evenimente: niveluri noi, realizări, provocări
  const prev = useRef<{ level: number; attrs: Record<AttributeKey, number>; bonusId?: string } | null>(null);
  useEffect(() => {
    if (!state.character) return;
    const attrs = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, derived.attributes[k].level])) as Record<AttributeKey, number>;
    const bonus = activeBonus(state, new Date().toISOString());
    const p = prev.current;
    if (p) {
      for (const k of ATTRIBUTE_KEYS) {
        if (attrs[k] > p.attrs[k]) notify({ kind: 'level', title: `${ATTRIBUTE_MAP[k].label} · nivelul ${attrs[k]}`, body: 'Atributul a crescut.' });
      }
      if (derived.level.level > p.level) setCelebration({ level: derived.level.level, title: characterTitle(derived.level.level) });
      if (bonus && bonus.id !== p.bonusId && !bonus.revealed) {
        notify({ kind: 'bonus', title: 'Provocare nouă disponibilă', body: `Ai ${state.settings.bonusWindowHours}h pentru a o finaliza.` });
      }
    }
    const unlocked = unlockedAchievements(state);
    const fresh = unlocked.filter((id) => !state.meta.seenAchievements.includes(id));
    if (fresh.length) {
      if (p) {
        for (const id of fresh) {
          const a = ACHIEVEMENTS.find((x) => x.id === id)!;
          notify({ kind: 'achievement', title: `Realizare deblocată: ${a.title}`, body: a.description });
        }
      }
      dispatch({ type: 'meta/seeAchievements', ids: fresh });
    }
    prev.current = { level: derived.level.level, attrs, bonusId: bonus?.id };
  }, [state, derived, notify]);

  const value: AppContextValue = {
    state,
    session,
    now,
    today,
    api,
    derived,
    toasts,
    notify,
    dismissToast,
    celebration,
    closeCelebration: () => setCelebration(null),
    logout: onLogout,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp în afara AppProvider');
  return ctx;
}
