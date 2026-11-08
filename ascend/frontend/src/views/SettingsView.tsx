import { AlarmClock, Cloud, Download, HardDrive, KeyRound, LogOut, Monitor, Moon, Palette, Pencil, Plus, Shield, Sun, Trash2, Upload, User, Utensils, Wallet } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { averageDailyCredits, createEmptyState, normalizeState, scheduleLabel } from '../domain/engine';
import { DEFAULT_NUTRITION, targetsFor } from '../domain/nutrition';
import { AVATAR_COLORS } from '../domain/templates';
import type { GoalMode, Task } from '../domain/types';
import { APP_VERSION } from '../services/api';
import { useApp } from '../state/store';
import { Modal, ProfileAvatar, Switch } from '../ui/components';
import { fmt } from '../ui/format';
import { NutritionForm, RoutineSetup } from '../world/RoutineSetup';
import { TaskEditor } from './TaskEditor';

type SectionId = 'profile' | 'day' | 'nutrition' | 'rewards' | 'account';


function timeRule(t: Task) {
  if (t.kind === 'meal') return `Masă · în jur de ${t.time}`;
  const mode = t.timeMode ?? 'by';
  if (mode === 'log') return `Notez ora · reper ${t.time}`;
  return `${mode === 'by' ? 'Cel târziu' : 'Cel devreme'} la ${t.time}${t.tolerance ? ` · ±${t.tolerance} min` : ''}`;
}

export function SettingsView() {
  const { state, api, session, logout, notify, backend, today } = useApp();
  const s = state.settings;
  const c = state.character!;
  const [section, setSection] = useState<SectionId>('profile');
  const [pwOpen, setPwOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const routine = state.tasks.filter((t) => !t.archived && (t.kind === 'time' || t.kind === 'meal')).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const pace = averageDailyCredits(state, today);

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ascend-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) throw new Error('format');
      api.replaceState(normalizeState(parsed));
      notify({ kind: 'success', title: 'Date importate' });
    } catch {
      notify({ kind: 'error', title: 'Fișier invalid', body: 'Alege un backup exportat din Ascend.' });
    }
  }

  const setCooldown = (m: GoalMode, v: number) => api.updateSettings({ cooldownHours: { ...s.cooldownHours, [m]: Math.max(0, v) } });

  const NAV: { id: SectionId; icon: ReactNode; label: string; status: string }[] = [
    { id: 'profile', icon: <User size={17} />, label: 'Profil și aspect', status: `${c.name} · ${s.theme === 'system' ? 'tema sistemului' : s.theme === 'dark' ? 'întunecat' : 'luminos'}` },
    { id: 'day', icon: <AlarmClock size={17} />, label: 'Ziua mea', status: routine.length ? `${routine.length} repere și mese` : 'neconfigurată' },
    { id: 'nutrition', icon: <Utensils size={17} />, label: 'Nutriție', status: s.nutrition ? `${fmt(targetsFor(s.nutrition).kcal)} kcal / zi` : 'oprită' },
    { id: 'rewards', icon: <Wallet size={17} />, label: 'Credite și obiective', status: `1 credit = ${s.leiPerCredit} ${s.leiPerCredit === 1 ? 'leu' : 'lei'}` },
    { id: 'account', icon: <Shield size={17} />, label: 'Cont și date', status: backend.kind === 'server' ? 'sincronizat cu serverul' : 'doar în acest browser' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Setări</h1>
          <p>Toate regulile jocului, pe înțelesul tuturor. Modificările se salvează automat.</p>
        </div>
      </div>

      <div className="settings">
        <nav className="settings-nav" aria-label="Secțiuni setări">
          {NAV.map((n) => (
            <button key={n.id} className={`settings-nav-item ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
              <span className="settings-nav-icon">{n.icon}</span>
              <span className="grow">
                <b>{n.label}</b>
                <small>{n.status}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {section === 'profile' && (
            <Section title="Profil și aspect" desc="Numele, culoarea și aspectul aplicației.">
              <div className="settings-hero" style={{ ['--c' as string]: c.color }}>
                <ProfileAvatar name={c.name} color={c.color} size={72} />
                <div>
                  <b className="display" style={{ fontSize: 22 }}>{c.name}</b>
                  <div className="muted small">avatarul tău în aplicație</div>
                </div>
              </div>
              <Row title="Nume">
                <input className="input" style={{ width: 240 }} value={c.name} onChange={(e) => api.updateCharacter({ name: e.target.value })} />
              </Row>
              <Row title="Culoarea ta">
                <div className="row wrap">
                  {AVATAR_COLORS.map((col) => (
                    <button key={col} className={`color-swatch ${col === c.color ? 'on' : ''}`} style={{ background: col }} onClick={() => api.updateCharacter({ color: col })} aria-label={col} />
                  ))}
                </div>
              </Row>
              <Row title="Tema panourilor" desc="Întunecat, luminos sau după setarea sistemului.">
                <div className="segmented">
                  {(
                    [
                      ['system', <Monitor size={14} key="m" />, 'Sistem'],
                      ['dark', <Moon size={14} key="d" />, 'Întunecat'],
                      ['light', <Sun size={14} key="l" />, 'Luminos'],
                    ] as const
                  ).map(([v, icon, label]) => (
                    <button key={v} className={s.theme === v ? 'active' : ''} onClick={() => api.updateSettings({ theme: v })}>
                      <span className="row" style={{ gap: 6 }}>
                        {icon} {label}
                      </span>
                    </button>
                  ))}
                </div>
              </Row>
            </Section>
          )}

          {section === 'day' && (
            <Section title="Ziua mea" desc="Reperele cu oră și mesele care apar în fiecare zi pe drum și în desfășurător.">
              {routine.length === 0 ? (
                <div className="settings-empty">
                  <Palette size={28} />
                  <p>Încă nu ai configurat ziua. Spune-mi la ce oră te trezești, când mergi la program și când mănânci.</p>
                  <button className="btn btn-primary" onClick={() => setRoutineOpen(true)}>
                    Configurează ziua
                  </button>
                </div>
              ) : (
                <>
                  <div className="routine-items">
                    {routine.map((t) => (
                      <div key={t.id} className="routine-item">
                        <span className="routine-time num">{t.time}</span>
                        <span className="routine-kind">{t.kind === 'meal' ? <Utensils size={15} /> : <AlarmClock size={15} />}</span>
                        <span className="grow">
                          <b>{t.title}</b>
                          <small>
                            {timeRule(t)} · {scheduleLabel(t)} · {t.points} pct
                          </small>
                        </span>
                        <button className="btn btn-ghost btn-icon" onClick={() => setEditing(t)} aria-label={`Editează ${t.title}`}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn btn-ghost btn-icon" onClick={() => api.archiveTask(t.id, true)} aria-label={`Scoate ${t.title}`} title="Scoate de pe drum (arhivează)">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="btn mt-12" onClick={() => setRoutineOpen(true)}>
                    <Plus size={15} /> Adaugă repere sau mese
                  </button>
                </>
              )}
            </Section>
          )}

          {section === 'nutrition' && (
            <Section title="Nutriție" desc="Pe baza profilului calculez țintele zilnice. Seara primești un scor după cât de bine te-ai încadrat (±10% = perfect).">
              <Row title="Ținte de nutriție" desc={s.nutrition ? 'Active' : 'Oprite — mesele se pot nota oricum, fără scor.'}>
                <Switch checked={!!s.nutrition} onChange={(v) => api.updateSettings({ nutrition: v ? DEFAULT_NUTRITION : undefined })} label="Ținte de nutriție" />
              </Row>
              {s.nutrition && (
                <div className="mt-12">
                  <NutritionForm value={s.nutrition} onChange={(n) => api.updateSettings({ nutrition: n })} />
                </div>
              )}
              {state.foods.length > 0 && (
                <Row title="Alimentele mele" desc={`${state.foods.length} alimente salvate pentru notare rapidă.`}>
                  <span />
                </Row>
              )}
            </Section>
          )}

          {section === 'rewards' && (
            <Section title="Credite și obiective" desc="Cât valorează un credit și cât timp de gândire ai înainte de o cumpărare.">
              <Row title="Valoarea unui credit" desc={`Exemplu: un laptop de 6.000 lei = ${fmt(Math.ceil(6000 / s.leiPerCredit))} credite${pace > 0 ? ` ≈ ${Math.ceil(6000 / s.leiPerCredit / pace)} zile la ritmul tău` : ''}.`}>
                <NumberInput value={s.leiPerCredit} step={0.1} min={0.1} suffix="lei" onChange={(v) => api.updateSettings({ leiPerCredit: Math.max(0.1, v) })} />
              </Row>
              <Row title="Timp de gândire · cumpărături" desc="Un obiectiv nou stă în reflecție înainte să poată primi credite.">
                <NumberInput value={s.cooldownHours.shopping} min={0} suffix="ore" onChange={(v) => setCooldown('shopping', v)} />
              </Row>
              <Row title="Timp de gândire · răsfăț">
                <NumberInput value={s.cooldownHours.leisure} min={0} suffix="ore" onChange={(v) => setCooldown('leisure', v)} />
              </Row>
              <Row title="Timp de gândire · dezvoltare" desc="Investițiile în tine pot avea 0 ore.">
                <NumberInput value={s.cooldownHours.development} min={0} suffix="ore" onChange={(v) => setCooldown('development', v)} />
              </Row>
            </Section>
          )}


          {section === 'account' && (
            <Section title="Cont și date" desc="Unde stau datele tale și cum le păstrezi în siguranță.">
              <Row
                title="Stocare"
                desc={backend.kind === 'server' ? 'Pe serverul tău (MariaDB), sincronizat între dispozitive.' : 'Doar în acest browser. Pornește serverul Docker pentru sincronizare.'}
              >
                <span className={`badge ${backend.kind === 'server' ? 'badge-success' : 'badge-warning'}`}>
                  {backend.kind === 'server' ? <Cloud size={13} /> : <HardDrive size={13} />} {backend.kind === 'server' ? 'Server' : 'Local'}
                </span>
              </Row>
              <Row title="Versiunea aplicației" desc={backend.kind === 'server' ? 'Se actualizează automat dacă ai pornit actualizarea automată pe laptop.' : 'Mod local.'}>
                <span className="badge num">{APP_VERSION}</span>
              </Row>
              <Row title="Cont" desc={session.email}>
                <button className="btn" onClick={() => logout()}>
                  <LogOut size={15} /> Deconectare
                </button>
              </Row>
              {backend.auth.changePassword && (
                <Row title="Parolă" desc="Schimbarea parolei deconectează celelalte dispozitive.">
                  <button className="btn" onClick={() => setPwOpen(true)}>
                    <KeyRound size={15} /> Schimbă parola
                  </button>
                </Row>
              )}
              <Row title="Copie de siguranță" desc="Un fișier cu toate datele tale. Îl poți importa oricând.">
                <div className="row">
                  <button className="btn" onClick={exportData}>
                    <Download size={15} /> Exportă
                  </button>
                  <button className="btn" onClick={() => fileRef.current?.click()}>
                    <Upload size={15} /> Importă
                  </button>
                  <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
                </div>
              </Row>
              <Row title="Zona periculoasă" desc="Șterge personajul, sarcinile, creditele și obiectivele.">
                <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
                  Resetează tot
                </button>
              </Row>
            </Section>
          )}
        </div>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {routineOpen && <RoutineSetup onClose={() => setRoutineOpen(false)} />}
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {confirmReset && (
        <Modal
          size="sm"
          title="Resetezi toate datele?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Renunță
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => {
                  exportData();
                  api.replaceState(createEmptyState());
                  setConfirmReset(false);
                }}
              >
                Exportă copia și șterge
              </button>
            </>
          }
        >
          <p className="text-2">Acțiunea nu poate fi anulată. Înainte de ștergere descarc automat o copie de siguranță, ca să poți reveni.</p>
        </Modal>
      )}
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="card settings-section">
      <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
      {desc && <p className="muted small mt-8">{desc}</p>}
      <div className="mt-12">{children}</div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="setting-row wrap">
      <div className="col">
        <span className="strong">{title}</span>
        {desc && <span className="muted small">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, suffix, min, max, step = 1 }: { value: number; onChange: (v: number) => void; suffix: string; min?: number; max?: number; step?: number }) {
  return (
    <div className="input-suffix" style={{ width: 130 }}>
      <input className="input num" type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      <span>{suffix}</span>
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { backend, notify } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    if (next.length < 8) return setError('Parola nouă trebuie să aibă cel puțin 8 caractere.');
    setBusy(true);
    try {
      await backend.auth.changePassword!(current, next);
      notify({ kind: 'success', title: 'Parola a fost schimbată' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      title="Schimbă parola"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Renunță
          </button>
          <button className="btn btn-primary" disabled={busy || !current || !next} onClick={() => submit()}>
            Salvează
          </button>
        </>
      }
    >
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field">
          <label>Parola curentă</label>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Parola nouă</label>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}
