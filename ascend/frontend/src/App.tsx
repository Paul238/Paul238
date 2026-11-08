import { Orbit, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from './services/auth';
import { APP_VERSION, detectServer } from './services/api';
import { resolveBackend, type Backend } from './services/backend';
import type { Loaded } from './services/storage';
import { AppProvider, useApp } from './state/store';
import { Toasts } from './ui/components';
import { AuthView } from './views/AuthView';
import { CharacterView } from './views/CharacterView';
import { GoalsView } from './views/GoalsView';
import { OnboardingView } from './views/OnboardingView';
import { SettingsView } from './views/SettingsView';
import { AppLayout, type AppView } from './views/AppLayout';
import { HomeView } from './views/HomeView';
import { PlanView } from './views/PlanView';
import { TodayList } from './views/TodayList';

const VIEWS: AppView[] = ['home', 'today', 'plan', 'goals'];

function useHashView(): [AppView, (v: AppView) => void] {
  const read = () => {
    const h = window.location.hash.replace('#/', '') as AppView;
    return VIEWS.includes(h) ? h : 'home';
  };
  const [view, setView] = useState<AppView>(read);
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

/** după o actualizare automată a serverului, tab-urile deschise află că există o versiune nouă */
function UpdateBanner() {
  const { backend } = useApp();
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    if (backend.kind !== 'server') return;
    const check = async () => {
      const info = await detectServer(4000);
      if (info?.version && info.version !== APP_VERSION) setFresh(info.version);
    };
    const id = setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [backend.kind]);
  if (!fresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>
        <b>Versiune nouă instalată</b> ({fresh}). Reîncarcă pentru a o folosi.
      </span>
      <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
        Reîncarcă
      </button>
    </div>
  );
}

function Panel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.overlay, .sheet-overlay') && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="panel-overlay">
      <div className="panel">
        <button className="panel-close" onClick={onClose} aria-label="Închide">
          <X size={20} />
        </button>
        <div className="panel-content">{children}</div>
      </div>
    </div>
  );
}

function Shell() {
  const { state, toasts, dismissToast } = useApp();
  const [view, go] = useHashView();
  const [panel, setPanel] = useState<'settings' | 'stats' | null>(null);
  const [planKey, setPlanKey] = useState(0);
  if (!state.character) return <OnboardingView />;
  return (
    <>
      <AppLayout view={view} go={go} openSettings={() => setPanel('settings')}>
        {view === 'home' && <HomeView go={go} openSettings={() => setPanel('settings')} openStats={() => setPanel('stats')} />}
        {view === 'today' && <TodayList onPlanTomorrow={() => (setPlanKey((k) => k + 1), go('plan'))} />}
        {view === 'plan' && <PlanView key={planKey} />}
        {view === 'goals' && <GoalsView />}
      </AppLayout>
      {panel && (
        <Panel onClose={() => setPanel(null)}>
          {panel === 'settings' && <SettingsView />}
          {panel === 'stats' && <CharacterView />}
        </Panel>
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <UpdateBanner />
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
          <Orbit size={22} />
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
