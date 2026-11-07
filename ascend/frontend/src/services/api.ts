/** client HTTP pentru API-ul PHP (aceeași origine, cookie de sesiune httpOnly) */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  keepalive?: boolean;
}

export async function request<T>(path: string, { method = 'GET', body, keepalive }: RequestOptions = {}): Promise<T> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(`api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ascend' },
      body: payload,
      // keepalive are limită de ~64KB în browsere
      keepalive: keepalive && (payload?.length ?? 0) < 60_000,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Serverul nu răspunde. Verifică dacă rulează.');
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(res.status, 'bad_response', 'Răspuns invalid de la server.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, String(data.code ?? 'error'), String(data.error ?? 'A apărut o eroare.'), data);
  }
  return data as T;
}

export interface ServerInfo {
  registration: boolean;
  version?: string;
}

/** versiunea cu care a fost construită interfața (setată la build din git) */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** verifică dacă aplicația este servită de backend-ul Ascend */
export async function detectServer(timeoutMs = 3000): Promise<ServerInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('api/health', { signal: ctrl.signal, credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.service === 'ascend' ? { registration: !!data.registration, version: data.version } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
