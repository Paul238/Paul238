import { CalendarDays, History, ListChecks, Orbit, Settings, ShoppingCart, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

export type AppView = 'home' | 'today' | 'plan' | 'goals' | 'history';

const NAV: { id: AppView; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Personaj', icon: <UserRound size={20} /> },
  { id: 'today', label: 'Azi', icon: <ListChecks size={20} /> },
  { id: 'plan', label: 'Plan', icon: <CalendarDays size={20} /> },
  { id: 'goals', label: 'Cumpărături', icon: <ShoppingCart size={20} /> },
  { id: 'history', label: 'Istoric', icon: <History size={20} /> },
];

export function AppLayout({ view, go, openSettings, children }: { view: AppView; go: (v: AppView) => void; openSettings: () => void; children: ReactNode }) {
  const items = (
    <>
      {NAV.map((n) => (
        <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined}>
          {n.icon}
          <span>{n.label}</span>
        </button>
      ))}
    </>
  );
  return (
    <div className="shell app2">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Orbit size={16} />
          </div>
          Ascend
        </div>
        <nav className="nav">{items}</nav>
        <button className="nav-item sidebar-foot" onClick={openSettings}>
          <Settings size={20} />
          <span>Setări</span>
        </button>
      </aside>
      <main className="main">
        <div className="content">{children}</div>
      </main>
      <nav className="bottom-nav">{items}</nav>
    </div>
  );
}
