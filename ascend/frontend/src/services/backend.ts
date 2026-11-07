import { detectServer } from './api';
import { localAuth, serverAuth, type AuthService } from './auth';
import { localRepository, serverRepository, type Repository } from './storage';

export interface Backend {
  kind: 'server' | 'local';
  registration: boolean;
  auth: AuthService;
  repo: Repository;
}

export const localBackend: Backend = { kind: 'local', registration: true, auth: localAuth, repo: localRepository };

/** folosește serverul dacă aplicația e servită de el, altfel modul local */
export async function resolveBackend(): Promise<Backend> {
  const server = await detectServer();
  return server ? { kind: 'server', registration: server.registration, auth: serverAuth, repo: serverRepository } : localBackend;
}
