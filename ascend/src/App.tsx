import { useEffect, useState } from 'react';
import { localAuth, type Session } from './services/auth';
import { AppProvider, useApp } from './state/store';
import { CharacterView } from './views/CharacterView';
import { GoalsView } from './views/GoalsView';
import { Layout, type View } from './views/Layout';
import { OnboardingView } from './views/OnboardingView';
import { SettingsView } from './views/SettingsView';
import { TasksView } from './views/TasksView';
import { TodayView } from './views/TodayView';
import { AuthView } from './views/AuthView';

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

export default function App() {
  const [session, setSession] = useState<Session | null>(() => localAuth.current());
  if (!session) return <AuthView onAuth={setSession} />;
  return (
    <AppProvider
      key={session.userId}
      session={session}
      onLogout={() => {
        localAuth.logout();
        setSession(null);
      }}
    >
      <Shell />
    </AppProvider>
  );
}
