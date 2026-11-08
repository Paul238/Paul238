import { Plus, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { METRIC_XP, metricHistory, metricStatus, plausibleMetric, type MetricDef } from '../domain/metrics';
import { useApp } from '../state/store';
import { fmt, fmt1, fmtDate } from '../ui/format';

/** grafic simplu cu ultimele valori; banda verde = intervalul orientativ normal */
export function Sparkline({ values, normal, color = 'var(--accent)' }: { values: number[]; normal?: [number, number]; color?: string }) {
  if (values.length < 2) return <div className="spark-empty">Graficul apare de la a doua măsurătoare.</div>;
  const W = 300;
  const H = 70;
  const lo = Math.min(...values, normal?.[0] ?? Infinity);
  const hi = Math.max(...values, normal?.[1] ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none" aria-hidden="true">
      {normal && <rect x="0" width={W} y={y(normal[1])} height={Math.max(1, y(normal[0]) - y(normal[1]))} fill="var(--success)" opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4" fill={color} />
    </svg>
  );
}

function show(def: MetricDef, v: number, v2?: number) {
  const f = def.step < 1 ? fmt1 : fmt;
  return def.pair ? `${f(v)}/${f(v2 ?? 0)}` : f(v);
}

export function MetricCard({ def, color, onRemove }: { def: MetricDef; color: string; onRemove?: () => void }) {
  const { state, api, today, notify } = useApp();
  const hist = metricHistory(state, def.key);
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  const [v2, setV2] = useState('');
  const [showHist, setShowHist] = useState(false);
  const status = metricStatus(def, last);
  const delta = last && prev ? last.value - prev.value : 0;
  const better = def.lowerIsBetter ? delta < 0 : delta > 0;

  function save() {
    const a = Number(v.replace(',', '.'));
    const b = def.pair ? Number(v2.replace(',', '.')) : undefined;
    if (!plausibleMetric(def, a, b)) {
      notify({ kind: 'error', title: 'Valoare neobișnuită', body: `Verifică numărul pentru ${def.label.toLowerCase()}.` });
      return;
    }
    const first = !hist.some((e) => e.date === today);
    api.addMetric(def.key, a, b);
    notify({ kind: 'success', title: `${def.label}: ${show(def, a, b)} ${def.unit}`, body: first ? `+${METRIC_XP} XP pentru că ai notat azi.` : 'Notat.' });
    setV('');
    setV2('');
    setOpen(false);
  }

  return (
    <div className="metric">
      <div className="metric-head">
        <div className="grow">
          <b>{def.label}</b>
          <small>{last ? `ultima: ${fmtDate(last.at, { day: 'numeric', month: 'short' })}` : def.hint}</small>
        </div>
        {last ? (
          <div className="metric-value">
            <span className="num">{show(def, last.value, last.value2)}</span>
            <small>{def.unit}</small>
          </div>
        ) : (
          <span className="muted small">—</span>
        )}
        {onRemove && (
          <button className="btn btn-ghost btn-icon metric-remove" onClick={onRemove} aria-label={`Nu mai urmăresc ${def.label}`} title="Nu mai urmăresc">
            <X size={14} />
          </button>
        )}
      </div>
      {last && (
        <div className="metric-tags">
          {status !== 'none' && <span className={`badge ${status === 'ok' ? 'badge-success' : 'badge-warning'}`}>{status === 'ok' ? 'în interval' : 'de urmărit'}</span>}
          {prev && delta !== 0 && (
            <span className={`badge ${def.lowerIsBetter === undefined ? '' : better ? 'badge-success' : 'badge-warning'}`}>
              {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta > 0 ? '+' : ''}
              {def.step < 1 ? fmt1(delta) : fmt(delta)} față de data trecută
            </span>
          )}
        </div>
      )}
      {hist.length > 1 && <Sparkline values={hist.slice(-30).map((e) => e.value)} normal={def.normal} color={color} />}

      {open ? (
        <div className="metric-form">
          <div className="input-suffix" style={{ flex: 1 }}>
            <input className="input num" inputMode="decimal" autoFocus placeholder={def.pair ? def.pair[0] : 'valoare'} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !def.pair && save()} />
            <span>{def.pair ? '' : def.unit}</span>
          </div>
          {def.pair && (
            <div className="input-suffix" style={{ flex: 1 }}>
              <input className="input num" inputMode="decimal" placeholder={def.pair[1]} value={v2} onChange={(e) => setV2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
              <span>{def.unit}</span>
            </div>
          )}
          <button className="btn btn-primary" onClick={save} disabled={!v || (!!def.pair && !v2)}>
            Salvează
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Notează
          </button>
          {hist.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowHist(!showHist)}>
              Istoric ({hist.length})
            </button>
          )}
        </div>
      )}
      {showHist && (
        <div className="metric-hist">
          {[...hist].reverse().slice(0, 20).map((e) => (
            <div key={e.id} className="row-between small">
              <span className="muted">{fmtDate(e.at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="num strong">
                {show(def, e.value, e.value2)} {def.unit}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => api.deleteMetric(e.id)} aria-label="Șterge">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
