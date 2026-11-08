import { useState } from 'react';
import { GoalsView } from './GoalsView';
import { ShoppingList } from './ShoppingList';

/** „Cumpărături”: lista de cumpărături (bani reali) și obiectivele (plătite cu credite) */
export function MoneyView() {
  const [tab, setTab] = useState<'list' | 'goals'>('list');
  return (
    <div>
      {tab === 'list' && (
        <div className="page-head">
          <div>
            <h1>Cumpărături</h1>
            <p>Lista ta: bifezi ce ai cumpărat și scrii cât a costat.</p>
          </div>
        </div>
      )}
      <div className="segmented full money-tabs">
        <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          Listă de cumpărături
        </button>
        <button className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')}>
          Obiective (credite)
        </button>
      </div>
      <div className="mt-16">{tab === 'list' ? <ShoppingList /> : <GoalsView />}</div>
    </div>
  );
}
