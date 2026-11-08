import { useState } from 'react';
import { addDays } from '../domain/dates';
import { useApp } from '../state/store';
import { CalendarView } from './CalendarView';
import { QuickAdd } from './QuickAdd';
import { PlanDay, dayName } from './PlanDay';
import { TasksView } from './TasksView';

export type PlanTab = 'tomorrow' | 'calendar' | 'all';

/** ecranul „Plan”: mâine, calendarul și toate activitățile */
export function PlanView({ initial = 'tomorrow' }: { initial?: PlanTab }) {
  const { today } = useApp();
  const [tab, setTab] = useState<PlanTab>(initial);
  const tomorrow = addDays(today, 1);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Plan</h1>
          <p>Programul tău: scrie într-un rând ce faci și când — restul se ordonează singur.</p>
        </div>
      </div>
      {tab !== 'all' && (
        <div className="card mb-12">
          <QuickAdd />
        </div>
      )}
      <div className="segmented full plan-tabs">
        <button className={tab === 'tomorrow' ? 'active' : ''} onClick={() => setTab('tomorrow')}>
          Mâine
        </button>
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
          Calendar
        </button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          Toate activitățile
        </button>
      </div>
      <div className="mt-16">
        {tab === 'tomorrow' && (
          <div className="card">
            <h2 className="display" style={{ fontSize: 22 }}>
              {dayName(tomorrow)}
            </h2>
            <div className="mt-8">
              <PlanDay date={tomorrow} compact />
            </div>
          </div>
        )}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'all' && <TasksView embedded />}
      </div>
    </div>
  );
}
