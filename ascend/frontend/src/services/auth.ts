import { ApiError, request } from './api';

export interface Session {
  userId: string;
  email: string;
  name: string;
}

export interface AuthService {
  current(): Promise<Session | null>;
  register(email: string, password: string, name: string): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  changePassword?(current: string, next: string): Promise<void>;
}

export class AuthError extends Error {}

/* ------------------------------------------------------------------ */
/* Server: conturi în baza de date, sesiune prin cookie httpOnly        */
/* ------------------------------------------------------------------ */

interface ServerUser {
  id: number;
  email: string;
  name: string;
}
const toSession = (u: ServerUser): Session => ({ userId: String(u.id), email: u.email, name: u.name });

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError) throw new AuthError(e.message);
    throw e;
  }
}

export const serverAuth: AuthService = {
  async current() {
    try {
      const { user } = await request<{ user: ServerUser }>('auth/me');
      return toSession(user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  async register(email, password, name) {
    const { user } = await wrap(request<{ user: ServerUser }>('auth/register', { method: 'POST', body: { email, password, name } }));
    return toSession(user);
  },
  async login(email, password) {
    const { user } = await wrap(request<{ user: ServerUser }>('auth/login', { method: 'POST', body: { email, password } }));
    return toSession(user);
  },
  async logout() {
    await request('auth/logout', { method: 'POST' }).catch(() => undefined);
  },
  async changePassword(currentPassword, newPassword) {
    await wrap(request('auth/password', { method: 'POST', body: { currentPassword, newPassword } }));
  },
};

/* ------------------------------------------------------------------ */
/* Local: conturi în browser (când aplicația rulează fără server)       */
/* Parolele sunt derivate cu PBKDF2-SHA256 + sare aleatorie.            */
/* ------------------------------------------------------------------ */

interface Account {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
}

const ACCOUNTS_KEY = 'ascend.accounts';
const SESSION_KEY = 'ascend.session';
const ITERATIONS = 150_000;

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => new Uint8Array(Array.from(atob(s), (c) => c.charCodeAt(0)));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!crypto.subtle) throw new AuthError('Modul local necesită https sau localhost.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toB64(bits);
}

function readAccounts(): Account[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

const normalizeEmail = (e: string) => e.trim().toLowerCase();

export const localAuth: AuthService = {
  async current() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },

  async register(email, password, name) {
    const e = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AuthError('Adresa de email nu este validă.');
    if (password.length < 8) throw new AuthError('Parola trebuie să aibă cel puțin 8 caractere.');
    if (!name.trim()) throw new AuthError('Introdu un nume.');
    const accounts = readAccounts();
    if (accounts.some((a) => a.email === e)) throw new AuthError('Există deja un cont cu acest email.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const account: Account = {
      id: Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''),
      email: e,
      name: name.trim(),
      salt: toB64(salt),
      hash: await derive(password, salt),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
    return writeSession({ userId: account.id, email: account.email, name: account.name });
  },

  async login(email, password) {
    const e = normalizeEmail(email);
    const account = readAccounts().find((a) => a.email === e);
    if (!account || (await derive(password, fromB64(account.salt))) !== account.hash) {
      throw new AuthError('Email sau parolă incorectă.');
    }
    return writeSession({ userId: account.id, email: account.email, name: account.name });
  },

  async logout() {
    localStorage.removeItem(SESSION_KEY);
  },
};
