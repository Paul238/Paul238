import { ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, FastForward, Pencil, Plus, Repeat, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dateKey, parseKey } from '../../domain/dates';
import {
  CATEGORY_MAP,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  addMonths,
  guessCategory,
  installmentsLeft,
  loanStatus,
  monthOf,
  monthSummary,
  parseMoneyLine,
  recurringForMonth,
  type CategoryKey,
  type Recurring,
} from '../../domain/money';
import { useApp } from '../../state/store';
import { Modal, Switch } from '../../ui/components';
import { ron } from '../../ui/format';

export function monthTitle(m: string) {
  const s = parseKey(`${m}-01`).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { today } = useApp();
  return (
    <div className="row month-nav">
      <button className="btn btn-icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Luna anterioară">
        <ChevronLeft size={18} />
      </button>
      <b className="month-title">{monthTitle(month)}</b>
      <button className="btn btn-icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Luna următoare">
        <ChevronRight size={18} />
      </button>
      {month !== monthOf(today) && (
        <button className="btn btn-sm" onClick={() => setMonth(monthOf(today))}>
          Luna asta
        </button>
      )}
    </div>
  );
}

export function CategorySelect({ value, onChange, income }: { value: CategoryKey; onChange: (c: CategoryKey) => void; income?: boolean }) {
  return (
    <select className="select cat-select" value={value} onChange={(e) => onChange(e.target.value as CategoryKey)} aria-label="Categorie">
      {(income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Rând rapid: „Haine 250”, „Salariu 5200”                              */
/* ------------------------------------------------------------------ */

export function MoneyQuickAdd({ month }: { month: string }) {
  const { api, today, notify } = useApp();
  const [text, setText] = useState('');
  const [cat, setCat] = useState<CategoryKey | null>(null);
  const p = useMemo(() => (text.trim() ? parseMoneyLine(text) : null), [text]);
  const category = cat ?? (p ? guessCategory(p.title, p.type) : 'other');
  const date = monthOf(today) === month ? today : `${month}-01`;

  function save() {
    if (!p || !p.amount || !p.title) return;
    api.addTx({ type: p.type, title: p.title, amount: p.amount, category, date });
    notify({ kind: 'success', title: `${p.type === 'income' ? '+' : '−'}${ron(p.amount)} · ${p.title}`, body: CATEGORY_MAP[category].label });
    setText('');
    setCat(null);
  }

  return (
    <div className="mquick">
      <div className="qadd-input">
        <Plus size={16} />
        <input value={text} onChange={(e) => (setText(e.target.value), setCat(null))} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Adaugă un bon sau un venit… ex: Haine 250, Farmacie 43,5, Bonus 500 +" aria-label="Cheltuială sau venit nou" />
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!p?.amount || !p.title}>
          Adaugă
        </button>
      </div>
      {p && (
        <div className="qadd-preview">
          <span className={`qchip ${p.type === 'income' ? 'ok' : ''}`}>{p.type === 'income' ? 'venit' : 'cheltuială'}</span>
          <b>{p.title || '…'}</b>
          <span className="qchip gold">{p.amount ? ron(p.amount) : 'scrie suma'}</span>
          <CategorySelect value={category} onChange={setCat} income={p.type === 'income'} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Luna: venituri − cheltuieli = rămas                                 */
/* ------------------------------------------------------------------ */

export function MonthOverview({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { state, api, today } = useApp();
  const sum = monthSummary(state, month, today);
  const rec = recurringForMonth(state, month, today);
  const pending = rec.filter((x) => !x.tx);
  const maxCat = Math.max(1, ...sum.byCategory.map((c) => c.amount));
  const empty = sum.income === 0 && sum.expenses === 0 && rec.length === 0;

  return (
    <div className="col" style={{ gap: 14 }}>
      <MonthNav month={month} setMonth={setMonth} />

      <div className="money-hero">
        <div>
          <small>Venituri</small>
          <b className="num ok">{ron(sum.income)}</b>
        </div>
        <div>
          <small>Cheltuieli</small>
          <b className="num">{ron(sum.expenses)}</b>
        </div>
        <div className="money-left">
          <small>Rămas acum</small>
          <b className={`num ${sum.left < 0 ? 'bad' : ''}`}>{ron(sum.left)}</b>
          {(sum.pendingExpenses > 0 || sum.pendingIncome > 0) && (
            <span className="money-proj">
              după plățile care urmează: <b className={sum.projected < 0 ? 'bad' : ''}>{ron(sum.projected)}</b>
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <MoneyQuickAdd month={month} />
      </div>

      {empty && (
        <div className="card notice-info notice">
          <CircleAlert size={16} />
          <span>Începe cu salariul și plățile fixe (chirie, abonamente, rate) în tabul „Plăți recurente”. Se scad automat în fiecare lună.</span>
        </div>
      )}

      {rec.length > 0 && (
        <div className="card card-flush">
          <div className="money-card-head">
            <b>Plăți și încasări fixe</b>
            <span className="muted small">{pending.length ? `${pending.length} urmează` : 'toate marcate'}</span>
          </div>
          {rec.map(({ r, date, tx, overdue }) => (
            <div key={r.id} className={`mrow ${tx ? 'done' : ''} ${overdue ? 'late' : ''}`}>
              <span className="mrow-day num">{Number(date.slice(8))}</span>
              <span className="grow">
                <b>{r.title}</b>
                <small>
                  {CATEGORY_MAP[r.category].label}
                  {tx ? ` · ${r.type === 'income' ? 'încasat' : 'plătit'} ${parseKey(tx.date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}` : overdue ? ' · scadentă depășită' : r.auto ? ' · automat' : ''}
                </small>
              </span>
              <span className={`mrow-amount num ${r.type === 'income' ? 'ok' : ''}`}>
                {r.type === 'income' ? '+' : '−'}
                {ron(tx?.amount ?? r.amount)}
              </span>
              {tx ? (
                <button className="btn btn-ghost btn-icon" onClick={() => api.unpayRecurring(r.id, month)} title="Anulează marcarea" aria-label="Anulează marcarea">
                  <Undo2 size={15} />
                </button>
              ) : (
                <button className="btn btn-sm" onClick={() => api.payRecurring(r.id, month)}>
                  <Check size={14} /> {r.type === 'income' ? 'Încasat' : 'Am plătit'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sum.byCategory.length > 0 && (
        <div className="card">
          <div className="money-card-head" style={{ padding: 0, marginBottom: 10 }}>
            <b>Pe categorii</b>
            <span className="muted small">{ron(sum.expenses)}</span>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {sum.byCategory.map(({ key, amount }) => (
              <div key={key} className="catbar">
                <div className="row-between small">
                  <span className="row" style={{ gap: 6 }}>
                    <span className="dot" style={{ background: CATEGORY_MAP[key].color }} /> {CATEGORY_MAP[key].label}
                  </span>
                  <span className="num strong">
                    {ron(amount)} <span className="muted">· {Math.round((amount / Math.max(1, sum.expenses)) * 100)}%</span>
                  </span>
                </div>
                <div className="catbar-track">
                  <span style={{ width: `${(amount / maxCat) * 100}%`, background: CATEGORY_MAP[key].color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plăți recurente                                                     */
/* ------------------------------------------------------------------ */

export function RecurringView() {
  const { state, api, today } = useApp();
  const [edit, setEdit] = useState<Recurring | 'income' | 'expense' | null>(null);
  const [extra, setExtra] = useState<Recurring | null>(null);
  const list = state.recurring.filter((r) => !r.archived);
  const incomes = list.filter((r) => r.type === 'income');
  const expenses = list.filter((r) => r.type === 'expense');
  const month = monthOf(today);
  const monthlyIn = incomes.reduce((s, r) => s + r.amount, 0);
  const monthlyOut = expenses.filter((r) => !r.end || r.end >= month).reduce((s, r) => s + r.amount, 0);

  const row = (r: Recurring) => {
    const loan = loanStatus(state, r, today);
    const left = loan ? loan.left : installmentsLeft(r, month);
    return (
      <div key={r.id} className="mrow rec">
        <span className="mrow-day num" title="Ziua din lună">
          {r.day}
        </span>
        <span className="grow">
          <b>{r.title}</b>
          <small>
            {CATEGORY_MAP[r.category].label} · lunar pe {r.day}
            {r.auto ? ' · automat' : ' · marchezi tu'}
            {left !== null && left !== undefined && ` · ${left === 0 ? 'achitat' : `mai ai ${left} ${left === 1 ? 'rată' : 'rate'}`}`}
          </small>
          {loan && (
            <span className="loan">
              <span>
                Sold rămas <b>{ron(loan.remaining)}</b>
              </span>
              <span>
                ultima rată: <b>{monthTitle(loan.endMonth)}</b>
              </span>
              {loan.extraPaid > 0 && (
                <span className="ok">
                  plătit în avans {ron(loan.extraPaid)} · −{loan.savedMonths} {loan.savedMonths === 1 ? 'lună' : 'luni'}
                </span>
              )}
              <span className="loan-bar">
                <span style={{ width: `${Math.min(100, ((r.principal! - loan.remaining) / r.principal!) * 100)}%` }} />
              </span>
            </span>
          )}
        </span>
        <span className={`mrow-amount num ${r.type === 'income' ? 'ok' : ''}`}>
          {r.type === 'income' ? '+' : '−'}
          {ron(r.amount)}
        </span>
        {r.category === 'loans' && (
          <button className="btn btn-sm" onClick={() => setExtra(r)} title="Plată suplimentară care scade soldul">
            <FastForward size={14} /> În avans
          </button>
        )}
        <button className="btn btn-ghost btn-icon" onClick={() => setEdit(r)} aria-label={`Editează ${r.title}`}>
          <Pencil size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="money-hero">
        <div>
          <small>Încasări fixe / lună</small>
          <b className="num ok">{ron(monthlyIn)}</b>
        </div>
        <div>
          <small>Plăți fixe / lună</small>
          <b className="num">{ron(monthlyOut)}</b>
        </div>
        <div className="money-left">
          <small>Rămân pentru restul cheltuielilor</small>
          <b className={`num ${monthlyIn - monthlyOut < 0 ? 'bad' : ''}`}>{ron(monthlyIn - monthlyOut)}</b>
        </div>
      </div>

      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => setEdit('expense')}>
          <ArrowUpRight size={15} /> Plată fixă (chirie, abonament, rată)
        </button>
        <button className="btn" onClick={() => setEdit('income')}>
          <ArrowDownLeft size={15} /> Venit fix (salariu)
        </button>
      </div>

      <div className="card card-flush">
        <div className="money-card-head">
          <b>Venituri</b>
        </div>
        {incomes.length ? incomes.map(row) : <p className="muted small mrow">Adaugă salariul: intră automat în ziua lui.</p>}
        <div className="money-card-head">
          <b>Plăți</b>
        </div>
        {expenses.length ? expenses.map(row) : <p className="muted small mrow">Chirie, utilități, abonamente, rate…</p>}
      </div>

      {edit && <RecurringEditor value={typeof edit === 'string' ? undefined : edit} type={typeof edit === 'string' ? edit : edit.type} onClose={() => setEdit(null)} onDelete={(id) => (api.deleteRecurring(id), setEdit(null))} />}
      {extra && <ExtraPaymentModal r={extra} onClose={() => setExtra(null)} />}
    </div>
  );
}

function ExtraPaymentModal({ r, onClose }: { r: Recurring; onClose: () => void }) {
  const { state, api, today, notify } = useApp();
  const [v, setV] = useState('');
  const amount = Number(v.replace(',', '.')) || 0;
  const loan = loanStatus(state, r, today);
  const after = loan ? Math.max(0, loan.remaining - amount) : null;
  const leftAfter = after !== null ? Math.ceil(after / Math.max(1, r.amount)) : null;
  return (
    <Modal
      size="sm"
      title={`Plată în avans · ${r.title}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button
            className="btn btn-primary"
            disabled={amount <= 0}
            onClick={() => {
              api.payExtra(r.id, amount);
              notify({ kind: 'success', title: `Plată în avans: ${ron(amount)}`, body: r.title });
              onClose();
            }}
          >
            Înregistrează
          </button>
        </>
      }
    >
      <div className="field">
        <label>Suma plătită în plus</label>
        <div className="input-suffix">
          <input className="input num" inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="0" />
          <span>lei</span>
        </div>
      </div>
      {loan ? (
        <div className="notice notice-info">
          <FastForward size={16} />
          <span>
            Sold: {ron(loan.remaining)} → <b>{ron(after ?? 0)}</b>. Rate rămase: {loan.left} → <b>{leftAfter}</b>
            {loan.left - (leftAfter ?? 0) > 0 ? ` (cu ${loan.left - (leftAfter ?? 0)} mai puține)` : ''}.
          </span>
        </div>
      ) : (
        <p className="hint">Ca să vezi cu câte luni se scurtează, completează „Sold rămas” la editarea ratei.</p>
      )}
      <p className="hint">Calcul simplificat, fără dobândă. Verifică soldul exact pe extrasul băncii și actualizează-l la nevoie.</p>
    </Modal>
  );
}

function RecurringEditor({ value, type, onClose, onDelete }: { value?: Recurring; type: 'income' | 'expense'; onClose: () => void; onDelete: (id: string) => void }) {
  const { api, today } = useApp();
  const [title, setTitle] = useState(value?.title ?? '');
  const [amount, setAmount] = useState(value ? String(value.amount) : '');
  const [day, setDay] = useState(value?.day ?? Number(today.slice(8)));
  const [cat, setCat] = useState<CategoryKey | null>(value?.category ?? null);
  const [auto, setAuto] = useState(value?.auto ?? type === 'income');
  const [principal, setPrincipal] = useState(value?.principal ? String(value.principal) : '');
  const [end, setEnd] = useState(value?.end ?? '');
  const category = cat ?? (title ? guessCategory(title, type) : type === 'income' ? 'salary' : 'other');
  const isLoan = category === 'loans';
  const a = Number(amount.replace(',', '.'));
  const valid = title.trim() && a > 0 && day >= 1 && day <= 31;

  function save() {
    if (!valid) return;
    api.saveRecurring({
      id: value?.id,
      type,
      title: title.trim(),
      amount: a,
      category,
      day,
      start: value?.start ?? monthOf(today),
      end: end || undefined,
      auto,
      principal: isLoan && Number(principal) > 0 ? Number(principal.replace(',', '.')) : undefined,
    });
    onClose();
  }

  return (
    <Modal
      title={value ? `Editează: ${value.title}` : type === 'income' ? 'Venit fix' : 'Plată fixă'}
      onClose={onClose}
      footer={
        <>
          {value && (
            <button className="btn btn-ghost btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(value.id)}>
              <Trash2 size={15} /> Șterge
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            Salvează
          </button>
        </>
      }
    >
      <div className="grid grid-2">
        <div className="field">
          <label>Ce este?</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'income' ? 'Salariu' : 'Chirie, Netflix, Rată mașină…'} />
        </div>
        <div className="field">
          <label>{isLoan ? 'Rata lunară' : 'Suma lunară'}</label>
          <div className="input-suffix">
            <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            <span>lei</span>
          </div>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>Ziua din lună</label>
          <input className="input num" type="number" min={1} max={31} value={day} onChange={(e) => setDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
        </div>
        <div className="field">
          <label>Categorie</label>
          <CategorySelect value={category} onChange={setCat} income={type === 'income'} />
        </div>
      </div>
      {isLoan && (
        <div className="grid grid-2">
          <div className="field">
            <label>Sold rămas de plătit (opțional)</label>
            <div className="input-suffix">
              <input className="input num" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="ex. 24000" />
              <span>lei</span>
            </div>
            <span className="hint">Cu el calculez câte rate mai ai și cât scurtezi cu plățile în avans.</span>
          </div>
          <div className="field">
            <label>Ultima rată (opțional)</label>
            <input className="input" type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}
      {!isLoan && (
        <div className="field">
          <label>Până când (opțional)</label>
          <input className="input" type="month" value={end} onChange={(e) => setEnd(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
      )}
      <div className="row-between" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="col">
          <span className="strong small">
            <Repeat size={13} style={{ verticalAlign: -2 }} /> Se marchează automat în ziua ei
          </span>
          <span className="muted tiny">Altfel apare „de plătit” și apeși tu „Am plătit” (poți schimba suma dacă diferă).</span>
        </div>
        <Switch checked={auto} onChange={setAuto} label="Automat" />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Cheltuieli: toate mișcările lunii                                   */
/* ------------------------------------------------------------------ */

export function TransactionsView({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { state, api } = useApp();
  const rows = [
    ...state.transactions.filter((t) => monthOf(t.date) === month).map((t) => ({ id: t.id, date: t.date, title: t.title, amount: t.amount, type: t.type, category: t.category, source: t.recurringId ? (t.extra ? 'în avans' : 'fixă') : 'bon', tx: true })),
    ...state.shopping
      .filter((i) => i.boughtDate && monthOf(i.boughtDate) === month && (i.cost ?? 0) > 0)
      .map((i) => ({ id: i.id, date: i.boughtDate!, title: i.title, amount: i.cost!, type: 'expense' as const, category: i.category ?? ('other' as CategoryKey), source: 'listă', tx: false })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="col" style={{ gap: 14 }}>
      <MonthNav month={month} setMonth={setMonth} />
      <div className="card">
        <MoneyQuickAdd month={month} />
      </div>
      <div className="card card-flush">
        {rows.length === 0 && <p className="muted small mrow">Nicio mișcare în {monthTitle(month).toLowerCase()}.</p>}
        {rows.map((r) => (
          <div key={r.id} className="mrow">
            <span className="mrow-day num">{Number(r.date.slice(8))}</span>
            <span className="cat-dot" style={{ background: CATEGORY_MAP[r.category].color }} />
            <span className="grow">
              <b>{r.title}</b>
              <small>
                {CATEGORY_MAP[r.category].label} · {r.source}
              </small>
            </span>
            <span className={`mrow-amount num ${r.type === 'income' ? 'ok' : ''}`}>
              {r.type === 'income' ? '+' : '−'}
              {ron(r.amount)}
            </span>
            {r.tx ? (
              <button className="btn btn-ghost btn-icon" onClick={() => api.deleteTx(r.id)} aria-label={`Șterge ${r.title}`}>
                <Trash2 size={14} />
              </button>
            ) : (
              <span style={{ width: 40 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const currentMonth = () => monthOf(dateKey(new Date()));
