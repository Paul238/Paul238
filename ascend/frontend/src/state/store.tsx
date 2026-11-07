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
import type { AppState, AttributeKey, Character, CustomFood, FoodEntry, Goal, Settings, Task } from '../domain/types';
import type { Session } from '../services/auth';
import type { Backend } from '../services/backend';
import type { Loaded } from '../services/storage';

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
    completeTask: (taskId: string, value?: string) => dispatch({ type: 'task/complete', taskId, now: now(), id: uid('c'), value }),
    addFood: (date: string, taskId: string, food: Omit<FoodEntry, 'id'>) =>
      dispatch({ type: 'meal/addFood', date, taskId, food: { ...food, id: uid('f') }, logId: uid('m') }),
    removeFood: (date: string, taskId: string, foodId: string) => dispatch({ type: 'meal/removeFood', date, taskId, foodId }),
    saveFood: (food: Omit<CustomFood, 'id'>) => dispatch({ type: 'food/save', food: { ...food, id: uid('cf') } }),
    closeDay: (date: string) => dispatch({ type: 'day/close', date, now: now(), seed: uid('d') }),
    autoCloseDays: (today: string) => dispatch({ type: 'day/autoclose', today, now: now(), seed: uid('d') }),
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
  backend: Backend;
  sync: SyncStatus;
}

/** local = doar în browser; saved/saving/offline = sincronizare cu serverul */
export type SyncStatus = 'local' | 'saved' | 'saving' | 'offline';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  session,
  backend,
  initial,
  onLogout,
  children,
}: {
  session: Session;
  backend: Backend;
  initial: Loaded;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initial.state);
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

  /* ---------- persistență și sincronizare ---------- */
  const [sync, setSync] = useState<SyncStatus>(backend.kind === 'local' ? 'local' : 'saved');
  const revision = useRef(initial.revision);
  const latest = useRef(state);
  latest.current = state;
  const skipSave = useRef(true); // starea inițială vine din stocare, nu o salvăm înapoi
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const prevEvents = useRef<{ level: number; attrs: Record<AttributeKey, number>; bonusId?: string } | null>(null);

  /** înlocuiește starea cu versiunea de pe server, fără s-o retrimită */
  const adoptRemote = useCallback((remote: Loaded) => {
    revision.current = remote.revision;
    skipSave.current = true;
    prevEvents.current = null; // fără notificări pentru progresul făcut pe alt dispozitiv
    dispatch({ type: 'state/replace', state: remote.state });
  }, []);

  const flush = useCallback(
    async (keepalive = false) => {
      if (inFlight.current || !dirty.current) return;
      dirty.current = false;
      inFlight.current = true;
      if (backend.kind === 'server') setSync('saving');
      try {
        const res = await backend.repo.save(session.userId, latest.current, revision.current, { keepalive });
        if (res.ok) {
          revision.current = res.revision;
        } else {
          dirty.current = false;
          adoptRemote(res);
          notify({ kind: 'info', title: 'Date actualizate', body: 'Între timp s-au făcut modificări pe alt dispozitiv; am încărcat versiunea cea mai nouă.' });
        }
        if (backend.kind === 'server') setSync('saved');
      } catch {
        dirty.current = true;
        setSync('offline');
      } finally {
        inFlight.current = false;
      }
      if (dirty.current && navigator.onLine) timer.current = setTimeout(() => flush(), 800);
    },
    [backend, session.userId, adoptRemote, notify],
  );

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), backend.kind === 'local' ? 0 : 500);
  }, [state, flush, backend.kind]);

  // reîncearcă dacă serverul a fost indisponibil; preia modificările de pe alte dispozitive
  useEffect(() => {
    if (backend.kind !== 'server') return;
    const refresh = async () => {
      if (dirty.current || inFlight.current) return flush();
      try {
        const remote = await backend.repo.load(session.userId);
        setSync('saved');
        if (remote.revision !== revision.current && !dirty.current && !inFlight.current) adoptRemote(remote);
      } catch {
        setSync('offline');
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    const onHide = () => flush(true);
    const interval = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('online', refresh);
    };
  }, [backend, session.userId, flush, adoptRemote]);

  // temă
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // motorul provocărilor rulează periodic
  useEffect(() => {
    if (state.character) {
      api.tickBonus();
      api.autoCloseDays(today);
    }
  }, [now, today, state.character, api]);

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
  const prev = prevEvents;
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
    backend,
    sync,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp în afara AppProvider');
  return ctx;
}
