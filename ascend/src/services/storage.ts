import { createEmptyState, normalizeState } from '../domain/engine';
import type { AppState } from '../domain/types';

/** stratul de persistență — poate fi înlocuit cu un API/backend */
export interface Repository {
  load(userId: string): AppState;
  save(userId: string, state: AppState): void;
  clear(userId: string): void;
}

const key = (userId: string) => `ascend.data.${userId}`;

export const localRepository: Repository = {
  load(userId) {
    try {
      const raw = localStorage.getItem(key(userId));
      return raw ? normalizeState(JSON.parse(raw)) : createEmptyState();
    } catch {
      return createEmptyState();
    }
  },
  save(userId, state) {
    try {
      localStorage.setItem(key(userId), JSON.stringify(state));
    } catch (e) {
      console.error('Nu s-au putut salva datele', e);
    }
  },
  clear(userId) {
    localStorage.removeItem(key(userId));
  },
};
