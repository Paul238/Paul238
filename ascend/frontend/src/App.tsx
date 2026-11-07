import { Mountain } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Session } from './services/auth';
import { resolveBackend, type Backend } from './services/backend';
import type { Loaded } from './services/storage';
import { AppProvider, useApp } from './state/store';
import { AuthView } from './views/AuthView';
import { CharacterView } from './views/CharacterView';
import { GoalsView } from './views/GoalsView';
import { Layout, type View } from './views/Layout';
import { OnboardingView } from './views/OnboardingView';
import { SettingsView } from './views/SettingsView';
import { TasksView } from './views/TasksView';
import { TodayView } from './views/TodayView';

const VIEWS: View[] = ['today', 'tasks', 'goals', 'character', 'settings'];

function useHashView(): [View, (v: View) => void] {
  const read = () => {
    const h = window.location.hash.replace('#/', '') as View;
    return VIEWS.includes(h) ? h : 'today';
  };
  const [view, setView] = useState<View>(read);
  useEffect(() => {
    const on = () => setView(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [
    view,
    (v) => {
      window.location.hash = `/${v}`;
      window.scrollTo({ top: 0 });
    },
  ];
}

function Shell() {
  const { state } = useApp();
  const [view, go] = useHashView();
  if (!state.character) return <OnboardingView />;
  return (
    <Layout view={view} go={go}>
      {view === 'today' && <TodayView go={go} />}
      {view === 'tasks' && <TasksView />}
      {view === 'goals' && <GoalsView />}
      {view === 'character' && <CharacterView />}
      {view === 'settings' && <SettingsView />}
    </Layout>
  );
}

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'auth'; backend: Backend }
  | { phase: 'ready'; backend: Backend; session: Session; loaded: Loaded };

function Splash({ children }: { children?: React.ReactNode }) {
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
        <div className="muted small" style={{ maxWidth: 360 }}>{boot.message}</div>
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
        setBoot({ phase: 'auth', backend });
      }}
    >
      <Shell />
    </AppProvider>
  );
}
