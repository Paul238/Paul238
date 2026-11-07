import { Award, CircleCheck, Gift, Info, TrendingUp, TriangleAlert, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { ATTRIBUTE_KEYS, ATTRIBUTE_MAP } from '../domain/attributes';
import type { AttributeKey } from '../domain/types';
import type { Toast } from '../state/store';
import { initials } from './format';

export function Modal({
  title,
  onClose,
  children,
  footer,
  size,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'sm' ? 'modal-sm' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Închide">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, color, size }: { value: number; color?: string; size?: 'lg' | 'thin' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar ${size ? `bar-${size}` : ''}`} style={color ? { ['--bar-color' as string]: color } : undefined}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--accent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children && <div className="ring-label">{children}</div>}
    </div>
  );
}

export function Avatar({ name, color, size }: { name: string; color: string; size?: 'sm' | 'lg' }) {
  return (
    <div className={`avatar ${size ? `avatar-${size}` : ''}`} style={{ background: color }}>
      {initials(name)}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function AttributeChips({
  value,
  onChange,
  max = 3,
}: {
  value: AttributeKey[];
  onChange: (v: AttributeKey[]) => void;
  max?: number;
}) {
  return (
    <div className="row wrap">
      {ATTRIBUTE_KEYS.map((k) => {
        const on = value.includes(k);
        const idx = value.indexOf(k);
        return (
          <button
            type="button"
            key={k}
            className={`chip ${on ? 'on' : ''}`}
            style={{ ['--chip-color' as string]: ATTRIBUTE_MAP[k].color }}
            onClick={() => {
              if (on) onChange(value.filter((x) => x !== k));
              else if (value.length < max) onChange([...value, k]);
            }}
          >
            <span className="dot" />
            {ATTRIBUTE_MAP[k].label}
            {on && <span className="primary-mark">{idx === 0 ? 'principal' : '50%'}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** grafic radar pentru nivelurile atributelor */
export function Radar({ values, size = 280 }: { values: Record<AttributeKey, number>; size?: number }) {
  const keys = ATTRIBUTE_KEYS;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 44;
  const max = Math.max(5, ...keys.map((k) => values[k]));
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = keys.map((k, i) => pt(i, (values[k] / max) * R).join(',')).join(' ');
  return (
    <svg viewBox={`-36 -6 ${size + 72} ${size + 12}`} width="100%" style={{ maxWidth: size + 72, display: 'block', margin: '0 auto' }} role="img" aria-label="Profilul atributelor">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={keys.map((_, i) => pt(i, R * f).join(',')).join(' ')} fill="none" stroke="var(--border)" strokeWidth={1} />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="color-mix(in srgb, var(--accent) 22%, transparent)" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {keys.map((k, i) => {
        const [x, y] = pt(i, (values[k] / max) * R);
        return <circle key={k} cx={x} cy={y} r={3.5} fill={ATTRIBUTE_MAP[k].color} />;
      })}
      {keys.map((k, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={12.5} fill="var(--text-2)" fontWeight={500}>
            {ATTRIBUTE_MAP[k].label}
            <tspan x={x} dy={13} fill="var(--muted)" fontSize={11.5}>
              niv. {values[k]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

const TOAST_STYLE: Record<Toast['kind'], { bg: string; fg: string; icon: ReactNode }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', icon: <CircleCheck size={16} /> },
  info: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)', icon: <Info size={16} /> },
  level: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)', icon: <TrendingUp size={16} /> },
  achievement: { bg: 'var(--gold-soft)', fg: 'var(--gold)', icon: <Award size={16} /> },
  bonus: { bg: 'var(--gold-soft)', fg: 'var(--gold)', icon: <Gift size={16} /> },
  error: { bg: 'var(--danger-soft)', fg: 'var(--danger)', icon: <TriangleAlert size={16} /> },
};

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const st = TOAST_STYLE[t.kind];
        return (
          <div key={t.id} className="toast" onClick={() => onDismiss(t.id)}>
            <div className="toast-icon" style={{ background: st.bg, color: st.fg }}>
              {st.icon}
            </div>
            <div className="grow">
              <div className="t">{t.title}</div>
              {t.body && <div className="b">{t.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
