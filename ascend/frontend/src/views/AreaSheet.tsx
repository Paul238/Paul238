import { CornerDownLeft, EyeOff, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AREA_COLORS, ATTRIBUTES, BUILTIN_ATTRIBUTES, attributeDef } from '../domain/attributes';
import { isCompletedOn, scheduleLabel } from '../domain/engine';
import { uid } from '../domain/id';
import { activeMetrics, latestMetric, suggestedMetrics } from '../domain/metrics';
import { parseQuick } from '../domain/quickadd';
import { activitySuggestions } from '../domain/suggestions';
import type { AttributeKey, Task } from '../domain/types';
import { useApp } from '../state/store';
import { Modal } from '../ui/components';
import { fmt } from '../ui/format';
import { AREA_ICONS, AttrIcon } from '../ui/icons';
import { StageGlyph } from '../ui/stage';
import { Sheet } from '../world/Sheets';
import { MetricCard } from './MetricsPanel';

/** o latură a cercului: sarcinile ei, propuneri și măsurători — totul gestionat de aici */
export function AreaSheet({
  attr,
  onClose,
  onOpenTask,
  onEditTask,
}: {
  attr: AttributeKey;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  onEditTask: (t?: Task) => void;
}) {
  const { state, api, derived, today, notify } = useApp();
  const a = attributeDef(attr);
  const l = derived.attributes[attr] ?? { level: 1, into: 0, needed: 100, progress: 0 };
  const tasks = state.tasks.filter((t) => !t.archived && t.attributes.includes(attr));
  const count = (id: string) => state.completions.filter((c) => c.taskId === id).length;
  const [text, setText] = useState('');
  const titleOf = (s: string) => parseQuick(s, today).title;
  const sugg = useMemo(() => activitySuggestions(state, attr, titleOf), [state, attr, today]);
  const metrics = activeMetrics(state, attr);
  const metricSugg = suggestedMetrics(state, attr);
  const [newMetric, setNewMetric] = useState<{ label: string; unit: string } | null>(null);

  function addFromText(line: string) {
    const p = parseQuick(line, today);
    if (!p.title) return;
    const t: Task = {
      id: uid('t'),
      title: p.title,
      kind: p.kind,
      time: p.time,
      timeMode: p.kind === 'time' ? 'by' : undefined,
      tolerance: p.kind === 'time' ? 10 : undefined,
      points: p.points ?? 15,
      attributes: [attr],
      schedule: p.schedule,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    api.saveTask(t);
    notify({ kind: 'success', title: `Adăugat la ${a.label}: ${t.title}`, body: `${scheduleLabel(t)} · +${t.points} credite`, action: { label: 'Anulează', run: () => api.deleteTask(t.id) } });
  }

  return (
    <Sheet onClose={onClose} accent={a.color}>
      <div className="row" style={{ gap: 14 }}>
        <span className="attr-hero-icon" style={{ ['--c' as string]: a.color }}>
          <AttrIcon attr={attr} size={26} />
        </span>
        <div className="grow">
          <h2 className="sheet-title" style={{ margin: 0 }}>
            {a.label}
          </h2>
          {a.description && <p className="muted small">{a.description}</p>}
        </div>
        <div className="sheet-level num">{l.level}</div>
      </div>
      <div className="mt-12">
        <div className="row-between small">
          <span className="muted">Spre nivelul {l.level + 1}</span>
          <span className="num strong">
            {fmt(l.into)} / {fmt(l.needed)} XP
          </span>
        </div>
        <div className="attr-bar">
          <span style={{ width: `${l.progress * 100}%`, background: a.color }} />
        </div>
      </div>

      <div className="eyebrow-label mt-24">Sarcinile tale pentru {a.label.toLowerCase()}</div>
      <div className="sheet-list">
        {tasks.length === 0 && <p className="muted small">Încă nu ai nimic aici. Scrie mai jos sau alege o propunere.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="area-task">
            <button className="sheet-list-item grow" onClick={() => onOpenTask(t.id)}>
              <span className={`dot-state ${isCompletedOn(state, t.id, today) ? 'on' : ''}`} style={{ ['--c' as string]: a.color }} />
              <span className="asearch-icon" style={{ ['--c' as string]: a.color }}>
                <StageGlyph task={t} size={15} />
              </span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="strong">{t.title}</span>
                <span className="muted tiny" style={{ display: 'block' }}>
                  {scheduleLabel(t)}
                  {t.time ? ` · ${t.time}` : ''} · {count(t.id)} bifări{t.attributes[0] === attr ? '' : ' · 50% XP'}
                </span>
              </span>
              <span className="num strong" style={{ color: 'var(--gold)' }}>
                +{t.points}
              </span>
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => onEditTask(t)} aria-label={`Editează ${t.title}`} title="Editează">
              <Pencil size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="qadd-input mt-12">
        <Plus size={16} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              addFromText(text);
              setText('');
            }
          }}
          placeholder={`Adaugă la ${a.label}… ex: Sală luni miercuri vineri 25p`}
          aria-label={`Adaugă o sarcină la ${a.label}`}
        />
        <button
          className="btn btn-primary btn-sm"
          disabled={!text.trim()}
          onClick={() => {
            addFromText(text);
            setText('');
          }}
        >
          <CornerDownLeft size={14} /> Adaugă
        </button>
      </div>
      <button className="btn btn-ghost btn-sm mt-8" onClick={() => onEditTask(undefined)}>
        Cu toate opțiunile (oră, zile, puncte)…
      </button>

      {sugg.length > 0 && (
        <>
          <div className="eyebrow-label mt-24">Propuneri</div>
          <p className="hint">Ce aleg cel mai des oamenii pentru {a.label.toLowerCase()}. Atinge „+” ca să adaugi, „×” ca să nu mai apară.</p>
          <div className="sugg-list">
            {sugg.map((s) => {
              const p = parseQuick(s.text, today);
              return (
                <div key={s.id} className="sugg">
                  <button className="sugg-add" onClick={() => addFromText(s.text)} title="Adaugă în program">
                    <Plus size={14} />
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <b>{p.title}</b>
                      <small>
                        {scheduleLabel({ schedule: p.schedule } as Task)}
                        {p.time ? ` · ${p.time}` : ''} · +{p.points ?? 15}
                      </small>
                    </span>
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => api.dismissSuggestion(s.id)} aria-label={`Ascunde propunerea ${p.title}`} title="Nu mă interesează">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="eyebrow-label mt-24">Măsurători</div>
      {metrics.length > 0 ? (
        <div className="metrics-grid">
          {metrics.map((m) => (
            <MetricCard
              key={m.key}
              def={m}
              color={a.color}
              onRemove={() => {
                if (m.custom) {
                  if (!latestMetric(state, m.key) || confirm(`Ștergi măsurătoarea „${m.label}”? Valorile notate rămân în istoric, dar nu mai apar aici.`)) api.deleteCustomMetric(m.key);
                } else api.toggleMetric(m.key, false);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="muted small">Nu urmărești nimic aici.</p>
      )}
      {attr === 'health' && metrics.length > 0 && <p className="hint mt-8">Intervalele sunt orientative, nu sfat medical.</p>}
      <div className="row wrap mt-8" style={{ gap: 6 }}>
        {metricSugg.map((m) => (
          <span key={m.key} className="chip sugg-chip">
            <button onClick={() => api.toggleMetric(m.key, true)} title={`Urmărește ${m.label}`}>
              <Plus size={12} /> {m.label} <span className="muted">({m.unit})</span>
            </button>
            <button onClick={() => api.dismissSuggestion(`metric:${m.key}`)} aria-label={`Ascunde ${m.label}`} title="Nu mă interesează">
              <X size={12} />
            </button>
          </span>
        ))}
        {!newMetric && (
          <button className="chip" onClick={() => setNewMetric({ label: '', unit: '' })}>
            <Plus size={12} /> Măsurătoare proprie
          </button>
        )}
      </div>
      {newMetric && (
        <div className="row wrap mt-8" style={{ gap: 8 }}>
          <input className="input grow" style={{ minWidth: 140 }} autoFocus placeholder="Ce măsori? (ex. Flotări)" value={newMetric.label} onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })} />
          <input className="input" style={{ width: 110 }} placeholder="Unitate (ex. buc)" value={newMetric.unit} onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })} />
          <button
            className="btn btn-primary"
            disabled={!newMetric.label.trim()}
            onClick={() => {
              api.addCustomMetric({ label: newMetric.label, unit: newMetric.unit.trim(), attribute: attr, step: 1 });
              setNewMetric(null);
            }}
          >
            Adaugă
          </button>
          <button className="btn btn-ghost" onClick={() => setNewMetric(null)}>
            Renunță
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** editează cercul: scoate laturile care nu te interesează, adaugă altele */
export function AreasEditor({ onClose }: { onClose: () => void }) {
  const { state, api } = useApp();
  const visible = new Set(ATTRIBUTES.map((x) => x.key));
  const all = [...BUILTIN_ATTRIBUTES, ...state.areas.custom];
  const hidden = all.filter((x) => !visible.has(x.key));
  const [form, setForm] = useState({ label: '', description: '', color: AREA_COLORS[8], icon: 'star' });
  const taskCount = (k: AttributeKey) => state.tasks.filter((t) => !t.archived && t.attributes.includes(k)).length;

  return (
    <Modal title="Laturile cercului" onClose={onClose}>
      <p className="muted small">Scoate laturile care nu te interesează și adaugă-le pe ale tale. XP-ul și istoricul nu se pierd: o latură scoasă se poate readuce oricând.</p>
      <div className="col mt-12" style={{ gap: 6 }}>
        {ATTRIBUTES.map((x) => (
          <div key={x.key} className="area-row">
            <span className="attr-icon" style={{ ['--c' as string]: x.color, width: 30, height: 30 }}>
              <AttrIcon attr={x.key} size={16} />
            </span>
            <span className="grow">
              <b className="small">{x.label}</b>
              <span className="muted tiny" style={{ display: 'block' }}>
                {taskCount(x.key)} sarcini
              </span>
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={ATTRIBUTES.length <= 3}
              onClick={() => api.hideArea(x.key, true)}
              title={ATTRIBUTES.length <= 3 ? 'Păstrează cel puțin 3 laturi' : 'Scoate din cerc'}
            >
              <EyeOff size={14} /> Scoate
            </button>
          </div>
        ))}
      </div>

      {hidden.length > 0 && (
        <>
          <div className="eyebrow-label mt-16">Scoase din cerc</div>
          <div className="row wrap mt-8" style={{ gap: 6 }}>
            {hidden.map((x) => (
              <button key={x.key} className="chip" onClick={() => api.hideArea(x.key, false)} disabled={ATTRIBUTES.length >= 12}>
                <RotateCcw size={12} /> {x.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="eyebrow-label mt-16">Latură nouă</div>
      <div className="col mt-8" style={{ gap: 8 }}>
        <input className="input" placeholder="Nume (ex. Spiritualitate, Copii, Animale)" maxLength={24} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input className="input" placeholder="Ce înseamnă pentru tine (opțional)" maxLength={80} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="row wrap" style={{ gap: 6 }}>
          {AREA_COLORS.map((c) => (
            <button key={c} className={`color-swatch ${c === form.color ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} aria-label={`Culoare ${c}`} />
          ))}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {Object.entries(AREA_ICONS).map(([k, Icon]) => (
            <button key={k} className={`icon-pick ${form.icon === k ? 'on' : ''}`} style={{ ['--c' as string]: form.color }} onClick={() => setForm({ ...form, icon: k })} aria-label={`Pictogramă ${k}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          disabled={!form.label.trim() || ATTRIBUTES.length >= 12}
          onClick={() => {
            api.addArea({ label: form.label.trim(), description: form.description.trim(), color: form.color, icon: form.icon });
            setForm({ label: '', description: '', color: AREA_COLORS[8], icon: 'star' });
          }}
        >
          <Plus size={16} /> Adaugă în cerc
        </button>
        {ATTRIBUTES.length >= 12 && <span className="hint">Maxim 12 laturi în cerc.</span>}
      </div>
    </Modal>
  );
}
