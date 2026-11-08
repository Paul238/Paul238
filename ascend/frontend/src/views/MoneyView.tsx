import { useState } from 'react';
import { monthOf } from '../domain/money';
import { useApp } from '../state/store';
import { GoalsView } from './GoalsView';
import { MonthOverview, RecurringView, TransactionsView } from './money/MoneyParts';
import { ShoppingList } from './ShoppingList';

type Tab = 'month' | 'recurring' | 'shopping' | 'tx' | 'goals';
const TABS: [Tab, string][] = [
  ['month', 'Luna'],
  ['recurring', 'Plăți recurente'],
  ['shopping', 'Listă de cumpărături'],
  ['tx', 'Cheltuieli'],
  ['goals', 'Obiective'],
];

/** „Bani”: luna (venituri − cheltuieli), plăți recurente, lista de cumpărături, cheltuieli, obiective */
export function MoneyView() {
  const { today } = useApp();
  const [tab, setTab] = useState<Tab>('month');
  const [month, setMonth] = useState(monthOf(today));
  return (
    <div>
      {tab !== 'goals' && (
        <div className="page-head">
          <div>
            <h1>Bani</h1>
            <p>Salariul, plățile fixe și cumpărăturile — vezi mereu cât îți rămâne.</p>
          </div>
        </div>
      )}
      <div className="tabs money-tabs2" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'month' && <MonthOverview month={month} setMonth={setMonth} />}
      {tab === 'recurring' && <RecurringView />}
      {tab === 'shopping' && <ShoppingList />}
      {tab === 'tx' && <TransactionsView month={month} setMonth={setMonth} />}
      {tab === 'goals' && <GoalsView />}
    </div>
  );
}
