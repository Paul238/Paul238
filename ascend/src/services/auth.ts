/**
 * Autentificare locală (pe dispozitiv).
 *
 * Parolele nu sunt salvate în clar: se derivă un hash PBKDF2-SHA256 cu sare
 * aleatorie (Web Crypto). Interfața `AuthService` este gândită astfel încât
 * să poată fi înlocuită ulterior cu un backend real (ex. Supabase) fără
 * modificări în restul aplicației.
 */

export interface Session {
  userId: string;
  email: string;
  name: string;
}

export interface AuthService {
  current(): Session | null;
  register(email: string, password: string, name: string): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): void;
}

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

export class AuthError extends Error {}

const normalizeEmail = (e: string) => e.trim().toLowerCase();

export const localAuth: AuthService = {
  current() {
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
      id: crypto.randomUUID(),
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

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },
};
