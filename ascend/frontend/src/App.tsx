import { Mountain, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from './services/auth';
import { resolveBackend, type Backend } from './services/backend';
import type { Loaded } from './services/storage';
import { AppProvider, useApp } from './state/store';
import { Modal, Toasts } from './ui/components';
import { AuthView } from './views/AuthView';
import { CharacterView } from './views/CharacterView';
import { GoalsView } from './views/GoalsView';
import { OnboardingView } from './views/OnboardingView';
import { SettingsView } from './views/SettingsView';
import { TasksView } from './views/TasksView';
import { World, type PanelId } from './world/World';

const PANELS: PanelId[] = ['tasks', 'goals', 'hero', 'settings'];

/** panoul deschis peste lume este ținut în URL (#/tasks …), ca butonul Înapoi să-l închidă */
function useHashPanel(): [PanelId | null, (p: PanelId | null) => void] {
  const read = () => {
    const h = window.location.hash.replace('#/', '') as PanelId;
    return PANELS.includes(h) ? h : null;
  };
  const [panel, setPanel] = useState<PanelId | null>(read);
  useEffect(() => {
    const on = () => setPanel(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [
    panel,
    (p) => {
      if (p) window.location.hash = `/${p}`;
      else if (window.location.hash) history.back();
    },
  ];
}

function Panel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.overlay') && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="panel-overlay">
      <div className="panel">
        <button className="panel-close" onClick={onClose} aria-label="Înapoi în lume">
          <X size={20} />
        </button>
        <div className="panel-content">{children}</div>
      </div>
    </div>
  );
}

function Shell() {
  const { state, toasts, dismissToast, celebration, closeCelebration } = useApp();
  const [panel, setPanel] = useHashPanel();
  if (!state.character) return <OnboardingView />;
  return (
    <>
      <World openPanel={setPanel} />
      {panel && (
        <Panel onClose={() => setPanel(null)}>
          {panel === 'tasks' && <TasksView />}
          {panel === 'goals' && <GoalsView />}
          {panel === 'hero' && <CharacterView />}
          {panel === 'settings' && <SettingsView />}
        </Panel>
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {celebration && (
        <Modal size="sm" title="Nivel nou" onClose={closeCelebration}>
          <div className="celebrate">
            <div className="celebrate-level">{celebration.level}</div>
            <h2 style={{ fontSize: 20, marginTop: 8 }}>Ai ajuns la nivelul {celebration.level}</h2>
            <p className="muted">
              Titlu: <strong className="text-2">{celebration.title}</strong>. Consecvența construiește caracter.
            </p>
            <button className="btn btn-primary mt-12" onClick={closeCelebration}>
              Continuă
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'auth'; backend: Backend }
  | { phase: 'ready'; backend: Backend; session: Session; loaded: Loaded };

function Splash({ children }: { children?: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="col" style={{ alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <Mountain size={22} />
        </div>
        {children ?? <span className="muted">Se încarcă…</span>}
      </div>
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  async function enter(backend: Backend, session: Session) {
    const loaded = await backend.repo.load(session.userId);
    setBoot({ phase: 'ready', backend, session, loaded });
  }

  async function start() {
    setBoot({ phase: 'loading' });
    try {
      const backend = await resolveBackend();
      const session = await backend.auth.current();
      if (session) await enter(backend, session);
      else setBoot({ phase: 'auth', backend });
    } catch (e) {
      setBoot({ phase: 'error', message: e instanceof Error ? e.message : 'Eroare la pornire.' });
    }
  }

  useEffect(() => {
    start();
  }, []);

  if (boot.phase === 'loading') return <Splash />;
  if (boot.phase === 'error')
    return (
      <Splash>
        <div className="strong">Nu m-am putut conecta la server</div>
        <div className="muted small" style={{ maxWidth: 360 }}>
          {boot.message}
        </div>
        <button className="btn btn-primary" onClick={start}>
          Reîncearcă
        </button>
      </Splash>
    );
  if (boot.phase === 'auth') return <AuthView backend={boot.backend} onAuth={(s) => enter(boot.backend, s)} />;

  const { backend, session, loaded } = boot;
  return (
    <AppProvider
      key={session.userId}
      session={session}
      backend={backend}
      initial={loaded}
      onLogout={async () => {
        await backend.auth.logout();
        if (window.location.hash) history.replaceState(null, '', window.location.pathname);
        setBoot({ phase: 'auth', backend });
      }}
    >
      <Shell />
    </AppProvider>
  );
}
