import { Coins, Flame, LayoutDashboard, ListChecks, Mountain, Settings, Target, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { activeBonus } from '../domain/engine';
import { characterTitle } from '../domain/leveling';
import { useApp } from '../state/store';
import { Avatar, Bar, Modal, Toasts } from '../ui/components';
import { fmt } from '../ui/format';

export type View = 'today' | 'tasks' | 'goals' | 'character' | 'settings';

const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Azi', icon: <LayoutDashboard size={18} /> },
  { id: 'tasks', label: 'Sarcini', icon: <ListChecks size={18} /> },
  { id: 'goals', label: 'Obiective', icon: <Target size={18} /> },
  { id: 'character', label: 'Personaj', icon: <UserRound size={18} /> },
  { id: 'settings', label: 'Setări', icon: <Settings size={18} /> },
];

const TITLES: Record<View, string> = { today: 'Azi', tasks: 'Sarcini', goals: 'Obiective', character: 'Personaj', settings: 'Setări' };

export function Layout({ view, go, children }: { view: View; go: (v: View) => void; children: ReactNode }) {
  const { state, derived, toasts, dismissToast, celebration, closeCelebration, now } = useApp();
  const c = state.character!;
  const bonus = activeBonus(state, now);

  const navItems = (
    <>
      {NAV.map((n) => (
        <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
          {n.icon}
          <span>{n.label}</span>
          {n.id === 'today' && bonus && <span className="nav-badge">×{bonus.multiplier}</span>}
        </button>
      ))}
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Mountain size={16} />
          </div>
          Ascend
        </div>
        <nav className="nav">{navItems}</nav>
        <div className="sidebar-foot card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => go('character')}>
          <div className="row">
            <Avatar name={c.name} color={c.color} size="sm" />
            <div className="grow">
              <div className="strong small truncate">{c.name}</div>
              <div className="muted tiny">
                Nivel {derived.level.level} · {characterTitle(derived.level.level)}
              </div>
            </div>
          </div>
          <div className="mt-8">
            <Bar value={derived.level.progress} size="thin" />
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <div className="brand-mark" style={{ display: 'none' }} />
            <span className="strong">{TITLES[view]}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge" title="Serie curentă" style={{ height: 28, padding: '0 10px', fontSize: 13 }}>
              <Flame size={14} style={{ color: derived.streak.activeToday ? 'var(--warning)' : 'var(--muted)' }} /> {derived.streak.days}
            </span>
            <button className="badge badge-gold" title="Credite disponibile" style={{ height: 28, padding: '0 10px', fontSize: 13, border: 0 }} onClick={() => go('goals')}>
              <Coins size={14} /> {fmt(derived.available)}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">{navItems}</nav>
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
    </div>
  );
}
