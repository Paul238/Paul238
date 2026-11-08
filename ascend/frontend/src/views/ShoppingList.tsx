import { Check, Plus, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { addDays, weekStart } from '../domain/dates';
import { shoppingSpent, type ShoppingItem } from '../domain/shopping';
import { useApp } from '../state/store';
import { fmtDate, ron as lei } from '../ui/format';
import { Modal } from '../ui/components';

/** lista de cumpărături: adaugi, bifezi cu prețul, rămâne în istoric */
export function ShoppingList() {
  const { state, api, today } = useApp();
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('');
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const todo = state.shopping.filter((i) => !i.boughtAt).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const bought = state.shopping.filter((i) => i.boughtAt).sort((a, b) => (a.boughtAt! < b.boughtAt! ? 1 : -1));
  const monthFrom = today.slice(0, 8) + '01';
  const week = shoppingSpent(state.shopping, weekStart(today), addDays(weekStart(today), 6));
  const month = shoppingSpent(state.shopping, monthFrom, today);

  function add() {
    if (!title.trim()) return;
    api.addShopping(title, qty.trim());
    setTitle('');
    setQty('');
  }

  return (
    <div className="shop">
      <div className="card">
        <div className="shop-add">
          <ShoppingCart size={18} />
          <input className="shop-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ce ai de cumpărat? (ex. lapte, detergent…)" aria-label="Articol nou" />
          <input className="shop-qty" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="cantitate" aria-label="Cantitate" />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!title.trim()}>
            <Plus size={14} /> Adaugă
          </button>
        </div>
      </div>

      <div className="shop-stats">
        <div>
          <span className="num">{todo.length}</span>
          <small>de cumpărat</small>
        </div>
        <div>
          <span className="num">{lei(week)}</span>
          <small>cheltuit săptămâna asta</small>
        </div>
        <div>
          <span className="num">{lei(month)}</span>
          <small>cheltuit luna asta</small>
        </div>
      </div>

      <div className="card card-flush">
        {todo.length === 0 && <div className="empty small">Lista e goală. Adaugă mai sus ce ai de cumpărat.</div>}
        {todo.map((i) => (
          <div key={i.id} className="shop-row">
            <button className="shop-check" onClick={() => setBuying(i)} aria-label={`Bifează ${i.title}`}>
              <Check size={15} strokeWidth={3} />
            </button>
            <span className="grow">
              <b>{i.title}</b>
              {i.qty && <small>{i.qty}</small>}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={() => api.deleteShopping(i.id)} aria-label={`Șterge ${i.title}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {bought.length > 0 && (
        <>
          <h3 className="eyebrow-label mt-16">Cumpărate recent</h3>
          <div className="card card-flush mt-8">
            {bought.slice(0, 15).map((i) => (
              <div key={i.id} className="shop-row done">
                <span className="shop-check on">
                  <Check size={15} strokeWidth={3} />
                </span>
                <span className="grow">
                  <b>{i.title}</b>
                  <small>
                    {fmtDate(i.boughtAt!, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {i.qty ? ` · ${i.qty}` : ''}
                  </small>
                </span>
                <span className="shop-cost num">{i.cost !== undefined ? lei(i.cost) : '—'}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => api.unbuyShopping(i.id)} aria-label="Pune înapoi pe listă" title="Pune înapoi pe listă">
                  <RotateCcw size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {buying && <BuyModal item={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function BuyModal({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const { api } = useApp();
  const [cost, setCost] = useState('');
  const save = (withCost: boolean) => {
    const n = Number(cost.replace(',', '.'));
    api.buyShopping(item.id, withCost && cost && n >= 0 ? n : undefined);
    onClose();
  };
  return (
    <Modal
      size="sm"
      title={`Cumpărat: ${item.title}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => save(false)}>
            Fără preț
          </button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={!cost}>
            Salvează
          </button>
        </>
      }
    >
      <div className="field">
        <label>Cât a costat?</label>
        <div className="input-suffix">
          <input className="input num" inputMode="decimal" autoFocus value={cost} onChange={(e) => setCost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cost && save(true)} placeholder="0" />
          <span>lei</span>
        </div>
        <span className="hint">Apare în Istoric și la totalul cheltuit pe săptămână și lună.</span>
      </div>
    </Modal>
  );
}
