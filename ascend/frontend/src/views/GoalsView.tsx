import { Coffee, Coins, ExternalLink, GraduationCap, History, Hourglass, Pencil, PiggyBank, Plus, Scale, ShoppingBag, Star, TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import { averageDailyCredits, cooldownFor, developmentXp, goalProgress, goalRequiredCredits, savedInGoals } from '../domain/engine';
import type { AttributeKey, Goal, GoalMode } from '../domain/types';
import { useApp } from '../state/store';
import { Summit } from '../ui/Art';
import { Bar, Modal } from '../ui/components';
import { fmt, fmtDate, humanHours, lei } from '../ui/format';

type Tab = GoalMode | 'history';

const MODES: Record<GoalMode, { label: string; icon: ReactNode; blurb: string }> = {
  shopping: { label: 'Cumpărături', icon: <ShoppingBag size={15} />, blurb: 'Lucruri pe care vrei să le cumperi. Progresul se vede imediat; cumpărarea devine posibilă după perioada de reflecție.' },
  development: { label: 'Dezvoltare', icon: <GraduationCap size={15} />, blurb: 'Investiții în tine: cursuri, cărți, abonamente. La finalizare primești XP în atributul ales.' },
  leisure: { label: 'Răsfăț', icon: <Coffee size={15} />, blurb: 'Recompense mici: o ieșire, un film, o zi liberă.' },
};

export function GoalsView() {
  const { state, today, derived } = useApp();
  const [tab, setTab] = useState<Tab>('shopping');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const pace = averageDailyCredits(state, today);
  const saved = savedInGoals(state);
  const rate = state.settings.leiPerCredit;
  const closest = state.goals
    .filter((g) => g.status === 'active' || g.status === 'reflecting')
    .map((g) => ({ g, p: goalProgress(state, g) }))
    .sort((a, b) => b.p.ratio - a.p.ratio)[0];

  const goals = state.goals.filter((g) => (tab === 'history' ? g.status === 'purchased' || g.status === 'abandoned' : g.mode === tab && (g.status === 'active' || g.status === 'reflecting')));
  const countFor = (m: GoalMode) => state.goals.filter((g) => g.mode === m && (g.status === 'active' || g.status === 'reflecting')).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Obiective și portofel</h1>
          <p>Creditele tale contează automat la toate obiectivele. Când ai destule, cumperi direct de aici.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> Obiectiv nou
        </button>
      </div>

      <section className="vault">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="k row" style={{ gap: 6 }}>
            <Coins size={13} /> Credite disponibile
          </div>
          <div className="big num mt-8">
            {fmt(derived.available)}
            <small>≈ {lei(derived.available * rate)}</small>
          </div>
        </div>
        {closest ? (
          <VaultStat icon={<PiggyBank size={13} />} k="Cel mai aproape" v={`${Math.floor(closest.p.ratio * 100)}%`} s={closest.p.affordable ? `${closest.g.title} · îl poți cumpăra` : `${closest.g.title} · mai ai ${fmt(closest.p.missing)} cr`} />
        ) : (
          <VaultStat icon={<PiggyBank size={13} />} k="Rezervat" v={fmt(saved)} s={`≈ ${lei(saved * rate)} în obiective`} />
        )}
        <VaultStat icon={<TrendingUp size={13} />} k="Ritm" v={`${fmt(pace)}/zi`} s="media ultimelor 14 zile" />
        <VaultStat icon={<Scale size={13} />} k="Curs" v={`${rate} ${rate === 1 ? 'leu' : 'lei'}`} s="valoarea unui credit" />
      </section>

      <div className="tabs mt-24">
        {(Object.keys(MODES) as GoalMode[]).map((m) => (
          <button key={m} className={`tab ${tab === m ? 'active' : ''}`} onClick={() => setTab(m)}>
            {MODES[m].icon} {MODES[m].label} <span className="count">{countFor(m)}</span>
          </button>
        ))}
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <History size={15} /> Istoric
        </button>
      </div>

      {tab !== 'history' && <p className="muted small" style={{ marginBottom: 16 }}>{MODES[tab].blurb}</p>}

      {goals.length === 0 ? (
        <div className="card empty">
          <PiggyBank size={36} />
          <div className="strong text-2">{tab === 'history' ? 'Nicio achiziție încă' : 'Niciun obiectiv în această categorie'}</div>
          {tab !== 'history' && (
            <button className="btn btn-sm" onClick={() => setEditing('new')}>
              <Plus size={14} /> Adaugă obiectiv
            </button>
          )}
        </div>
      ) : tab === 'history' ? (
        <div className="card card-flush">
          {goals
            .sort((a, b) => ((a.closedAt ?? '') < (b.closedAt ?? '') ? 1 : -1))
            .map((g) => (
              <HistoryRow key={g.id} goal={g} />
            ))}
        </div>
      ) : (
        <div className="grid grid-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} pace={pace} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {editing && <GoalEditor goal={editing === 'new' ? undefined : editing} defaultMode={tab === 'history' ? 'shopping' : tab} onClose={() => setEditing(null)} />}
    </>
  );
}

function VaultStat({ icon, k, v, s }: { icon: ReactNode; k: string; v: string; s: string }) {
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="k row" style={{ gap: 6 }}>
        {icon} {k}
      </div>
      <div className="v num">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

/** cât „costă” obiectivul în muncă, raportat la istoricul tău */
function useWorkCost(credits: number) {
  const { state, today } = useApp();
  const pace = averageDailyCredits(state, today);
  const avgTask = state.completions.length ? state.completions.reduce((s, c) => s + c.credits, 0) / state.completions.length : 0;
  return {
    days: pace > 0 ? Math.ceil(credits / pace) : null,
    tasks: avgTask > 0 ? Math.ceil(credits / avgTask) : null,
  };
}

export function GoalCard({ goal, pace, onEdit }: { goal: Goal; pace: number; onEdit: () => void }) {
  const { state, api, now } = useApp();
  const [modal, setModal] = useState<'purchase' | 'abandon' | null>(null);
  const { required, have, missing, ratio, affordable } = goalProgress(state, goal);
  const rate = state.settings.leiPerCredit;
  const cost = useWorkCost(required);
  const funded = affordable;
  const reflecting = goal.status === 'reflecting';
  const readyToConfirm = reflecting && goal.activatesAt <= now;
  const eta = pace > 0 ? Math.ceil(missing / pace) : null;

  return (
    <div className="card goal-card">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row" style={{ gap: 6 }}>
            <span className="muted">{MODES[goal.mode].icon}</span>
            <h2 className="truncate display" style={{ fontSize: 21 }}>{goal.title}</h2>
          </div>
          {goal.reason && <p className="muted small mt-8">„{goal.reason}”</p>}
        </div>
        <div className="row" style={{ gap: 2 }}>
          {goal.url && (
            <a className="btn btn-ghost btn-icon" href={goal.url} target="_blank" rel="noreferrer" title="Deschide linkul">
              <ExternalLink size={15} />
            </a>
          )}
          <button className="btn btn-ghost btn-icon" onClick={onEdit} title="Editează">
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <Summit progress={ratio} funded={funded} variant={goal.title.length} />

      <div className="row-between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="goal-price">{lei(goal.price)}</div>
          <div className="muted small">{fmt(required)} credite</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="strong num">{Math.floor(ratio * 100)}%</div>
          <div className="muted small num">
            ai {lei(have * rate)} · {fmt(have)} cr
          </div>
        </div>
      </div>
      <Bar value={ratio} color={funded ? 'var(--success)' : 'var(--gold)'} size="lg" />
      {goal.saved > 0 && (
        <div className="row-between small">
          <span className="muted">Rezervat doar pentru acest obiectiv: {fmt(goal.saved)} cr</span>
          <button className="btn btn-ghost btn-sm" onClick={() => api.release(goal.id, goal.saved)}>
            Eliberează în portofel
          </button>
        </div>
      )}

      <div className="goal-facts">
        <div>
          <div className="k">Cost în muncă</div>
          <div className="v">{cost.days ? `~${cost.days} zile` : '—'}</div>
        </div>
        <div>
          <div className="k">Echivalent</div>
          <div className="v">{cost.tasks ? `~${fmt(cost.tasks)} sarcini` : '—'}</div>
        </div>
        <div>
          <div className="k">{funded ? 'Disponibil' : 'Mai ai nevoie de'}</div>
          <div className="v">{funded ? 'chiar acum' : `${fmt(missing)} cr${eta ? ` · ~${eta} zile` : ''}`}</div>
        </div>
      </div>

      {reflecting ? (
        <div className="notice notice-warning">
          <Hourglass size={16} />
          <div className="grow">
            <div className="strong">Perioadă de reflecție</div>
            <div className="small text-2">
              {readyToConfirm
                ? `Au trecut orele de gândire. Încă îl vrei? Confirmă și ${funded ? 'îl poți cumpăra imediat' : 'vei putea să-l cumperi când ai destule credite'}.`
                : `Mai ai ${humanHours(Date.parse(goal.activatesAt) - Date.parse(now))} până poți confirma. Gândește-te dacă e o nevoie reală.`}
            </div>
            <div className="row mt-8">
              <button className="btn btn-sm btn-primary" disabled={!readyToConfirm} onClick={() => api.confirmGoal(goal.id)}>
                Încă îl vreau
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal('abandon')}>
                Renunț
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row wrap">
          {funded ? (
            <button className="btn btn-gold" onClick={() => setModal('purchase')}>
              <ShoppingBag size={15} /> Cumpără acum · −{fmt(Math.max(0, required - goal.saved))} cr
            </button>
          ) : (
            <span className="muted small">Creditele tale contează automat. Continuă pe drum: mai ai {fmt(missing)} credite.</span>
          )}
          <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setModal('abandon')}>
            Renunț
          </button>
        </div>
      )}

      {modal === 'purchase' && <PurchaseModal goal={goal} required={required} onClose={() => setModal(null)} />}
      {modal === 'abandon' && (
        <Modal
          size="sm"
          title="Renunți la obiectiv?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Nu
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  api.abandonGoal(goal.id);
                  setModal(null);
                }}
              >
                Da, renunț
              </button>
            </>
          }
        >
          <p className="text-2">
            {goal.saved > 0 ? `Cele ${fmt(goal.saved)} credite alocate revin în portofel. ` : ''}A renunța la o dorință după reflecție este tot o victorie.
          </p>
        </Modal>
      )}
    </div>
  );
}

function PurchaseModal({ goal, required, onClose }: { goal: Goal; required: number; onClose: () => void }) {
  const { api, notify } = useApp();
  const cost = useWorkCost(required);
  const [ack, setAck] = useState(false);
  return (
    <Modal
      title="Finalizează achiziția"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Mai aștept
          </button>
          <button
            className="btn btn-gold"
            disabled={!ack}
            onClick={() => {
              api.purchase(goal.id);
              notify({ kind: 'achievement', title: `Obiectiv atins: ${goal.title}`, body: 'Bucură-te de el. Ai muncit pentru asta.' });
              onClose();
            }}
          >
            Confirm achiziția
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 4 }}>
        <span className="muted small">Obiectiv</span>
        <h2 style={{ fontSize: 18 }}>{goal.title}</h2>
        <span className="goal-price">{lei(goal.price)}</span>
      </div>
      <div className="goal-facts">
        <div>
          <div className="k">Se scad din portofel</div>
          <div className="v">−{fmt(Math.max(0, required - goal.saved))} cr</div>
        </div>
        <div>
          <div className="k">Zile de muncă</div>
          <div className="v">{cost.days ?? '—'}</div>
        </div>
        <div>
          <div className="k">Sarcini echivalente</div>
          <div className="v">{cost.tasks ? fmt(cost.tasks) : '—'}</div>
        </div>
      </div>
      {goal.mode === 'development' && goal.attribute && (
        <div className="notice notice-info">
          <GraduationCap size={16} />
          <span>
            Investiție în dezvoltare: primești <strong>+{developmentXp(required)} XP</strong> la {ATTRIBUTE_MAP[goal.attribute].label}.
          </span>
        </div>
      )}
      <label className="row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
        <span className="text-2">Am cântărit decizia. Este ceva ce îmi doresc cu adevărat, nu o cumpărătură din impuls.</span>
      </label>
    </Modal>
  );
}

function HistoryRow({ goal }: { goal: Goal }) {
  const { api, state } = useApp();
  const purchased = goal.status === 'purchased';
  return (
    <div className="list-item">
      <span className="muted">{MODES[goal.mode].icon}</span>
      <div className="grow">
        <div className="strong">{goal.title}</div>
        <div className="muted small">
          {purchased ? `Achiziționat ${fmtDate(goal.purchasedAt!)}` : `Renunțat ${goal.closedAt ? fmtDate(goal.closedAt) : ''}`} · {lei(goal.price)}
          {purchased && ` · ${fmt(goalRequiredCredits(goal, state.settings))} credite`}
        </div>
      </div>
      {purchased ? (
        <div className="col" style={{ alignItems: 'flex-end', gap: 0 }}>
          <span className="tiny muted">Cât de mulțumit ești?</span>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={(goal.rating ?? 0) >= n ? 'on' : ''} onClick={() => api.rateGoal(goal.id, n)} aria-label={`${n} stele`}>
                <Star size={16} fill="currentColor" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <span className="badge">Renunțat</span>
      )}
    </div>
  );
}

export function GoalEditor({ goal, defaultMode, onClose }: { goal?: Goal; defaultMode: GoalMode; onClose: () => void }) {
  const { api, state } = useApp();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [mode, setMode] = useState<GoalMode>(goal?.mode ?? defaultMode);
  const [price, setPrice] = useState(goal ? String(goal.price) : '');
  const [reason, setReason] = useState(goal?.reason ?? '');
  const [url, setUrl] = useState(goal?.url ?? '');
  const [attribute, setAttribute] = useState<AttributeKey | ''>(goal?.attribute ?? '');
  const p = Number(price);
  const credits = p > 0 ? Math.ceil(p / state.settings.leiPerCredit) : 0;
  const cost = useWorkCost(credits);
  const valid = title.trim() && p > 0;
  const cooldown = cooldownFor(state.settings, mode);

  function save() {
    if (!valid) return;
    const data = { title: title.trim(), mode, price: p, reason: reason.trim() || undefined, url: url.trim() || undefined, attribute: mode === 'development' && attribute ? attribute : undefined };
    if (goal) api.updateGoal(goal.id, data);
    else api.createGoal(data);
    onClose();
  }

  return (
    <Modal
      title={goal ? 'Editează obiectivul' : 'Obiectiv nou'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            Salvează
          </button>
        </>
      }
    >
      <div className="field">
        <label>Categorie</label>
        <div className="segmented full">
          {(Object.keys(MODES) as GoalMode[]).map((m) => (
            <button key={m} type="button" className={mode === m ? 'active' : ''} onClick={() => setMode(m)} disabled={!!goal && goal.status !== 'reflecting' && goal.status !== 'active'}>
              {MODES[m].label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>Ce îți dorești?</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Laptop" maxLength={60} />
        </div>
        <div className="field">
          <label>Preț</label>
          <div className="input-suffix">
            <input className="input num" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="6000" />
            <span>lei</span>
          </div>
        </div>
      </div>
      {mode === 'development' && (
        <div className="field">
          <label>Ce atribut dezvoltă?</label>
          <select className="select" value={attribute} onChange={(e) => setAttribute(e.target.value as AttributeKey)}>
            <option value="">— alege —</option>
            {ATTRIBUTE_KEYS.map((k) => (
              <option key={k} value={k}>
                {ATTRIBUTE_MAP[k].label}
              </option>
            ))}
          </select>
          <span className="hint">La finalizare primești XP bonus în acest atribut.</span>
        </div>
      )}
      <div className="field">
        <label>De ce îl vrei?</label>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. Laptopul actual nu mai face față proiectelor" />
        <span className="hint">Formularea motivului te ajută să deosebești o nevoie de un impuls.</span>
      </div>
      <div className="field">
        <label>Link (opțional)</label>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </div>
      {credits > 0 && (
        <div className="notice notice-gold">
          <Coins size={16} />
          <span>
            {fmt(credits)} credite
            {cost.days ? (
              <>
                {' '}
                ≈ <strong>{cost.days} zile</strong> de muncă la ritmul tău actual
              </>
            ) : null}
            {cost.tasks ? ` (~${fmt(cost.tasks)} sarcini)` : ''}.
          </span>
        </div>
      )}
      {!goal && cooldown > 0 && (
        <div className="notice notice-warning">
          <Hourglass size={16} />
          <span>Obiectivul intră {cooldown} ore în reflecție. După aceea confirmi dacă încă îl vrei și poți începe să aloci credite.</span>
        </div>
      )}
    </Modal>
  );
}
