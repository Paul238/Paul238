import { Award, CircleCheck, Info, TrendingUp, TriangleAlert, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { attributeDef, visibleAttributeKeys } from '../domain/attributes';
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
  size?: 'sm' | 'lg';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} role="dialog" aria-modal="true">
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
      {visibleAttributeKeys().map((k) => {
        const on = value.includes(k);
        const idx = value.indexOf(k);
        return (
          <button
            type="button"
            key={k}
            className={`chip ${on ? 'on' : ''}`}
            style={{ ['--chip-color' as string]: attributeDef(k).color }}
            onClick={() => {
              if (on) onChange(value.filter((x) => x !== k));
              else if (value.length < max) onChange([...value, k]);
            }}
          >
            <span className="dot" />
            {attributeDef(k).label}
            {on && <span className="primary-mark">{idx === 0 ? 'principal' : '50%'}</span>}
          </button>
        );
      })}
    </div>
  );
}

const TOAST_STYLE: Record<Toast['kind'], { bg: string; fg: string; icon: ReactNode }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', icon: <CircleCheck size={16} /> },
  info: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)', icon: <Info size={16} /> },
  level: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)', icon: <TrendingUp size={16} /> },
  achievement: { bg: 'var(--gold-soft)', fg: 'var(--gold)', icon: <Award size={16} /> },
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
            {t.action && (
              <button
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  t.action!.run();
                  onDismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** avatarul personajului: inițiale pe culoarea ta, cu inel de progres spre nivelul următor */
export function ProfileAvatar({ name, color, size = 120, progress, level }: { name: string; color: string; size?: number; progress?: number; level?: number }) {
  const stroke = Math.max(4, Math.round(size / 22));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="pavatar" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {progress !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * Math.max(0, Math.min(1, progress))} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="pavatar-face" style={{ background: color, inset: stroke + 4, fontSize: size * 0.3 }}>
        {initials(name)}
      </span>
      {level !== undefined && <span className="pavatar-level num">{level}</span>}
    </div>
  );
}
