import { createEmptyState, normalizeState } from '../domain/engine';
import type { AppState } from '../domain/types';
import { ApiError, request } from './api';

export interface Loaded {
  state: AppState;
  revision: number;
}

export type SaveResult = { ok: true; revision: number } | { ok: false; conflict: true; state: AppState; revision: number };

/** stratul de persistență */
export interface Repository {
  load(userId: string): Promise<Loaded>;
  save(userId: string, state: AppState, revision: number, opts?: { keepalive?: boolean }): Promise<SaveResult>;
}

/* ---------- server (MariaDB prin API-ul PHP) ---------- */

export const serverRepository: Repository = {
  async load() {
    const res = await request<{ data: Partial<AppState> | null; revision: number }>('state');
    return { state: res.data ? normalizeState(res.data) : createEmptyState(), revision: res.revision };
  },
  async save(_userId, state, revision, opts) {
    try {
      const res = await request<{ revision: number }>('state', { method: 'PUT', body: { data: state, revision }, keepalive: opts?.keepalive });
      return { ok: true, revision: res.revision };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const p = e.payload as { data: Partial<AppState> | null; revision: number };
        return { ok: false, conflict: true, state: p.data ? normalizeState(p.data) : createEmptyState(), revision: p.revision };
      }
      throw e;
    }
  },
};

/* ---------- local (localStorage) ---------- */

const key = (userId: string) => `ascend.data.${userId}`;

export const localRepository: Repository = {
  async load(userId) {
    try {
      const raw = localStorage.getItem(key(userId));
      return { state: raw ? normalizeState(JSON.parse(raw)) : createEmptyState(), revision: 0 };
    } catch {
      return { state: createEmptyState(), revision: 0 };
    }
  },
  async save(userId, state) {
    localStorage.setItem(key(userId), JSON.stringify(state));
    return { ok: true, revision: 0 };
  },
};
