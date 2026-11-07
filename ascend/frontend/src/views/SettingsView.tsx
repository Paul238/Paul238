import { Cloud, Download, HardDrive, KeyRound, LogOut, Monitor, Moon, Sun, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { WEEKDAY_SHORT, WEEK_ORDER } from '../domain/dates';
import { createEmptyState, normalizeState } from '../domain/engine';
import { AVATAR_COLORS } from '../domain/templates';
import type { BonusFrequency, GoalMode } from '../domain/types';
import { useApp } from '../state/store';
import { DEFAULT_NUTRITION } from '../domain/nutrition';
import { Modal, Switch } from '../ui/components';
import { NutritionForm, RoutineSetup } from '../world/RoutineSetup';

export function SettingsView() {
  const { state, api, session, logout, notify, backend } = useApp();
  const [pwOpen, setPwOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const s = state.settings;
  const c = state.character!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Setări</h1>
          <p>Ajustează regulile jocului după stilul tău.</p>
        </div>
      </div>

      <div className="col" style={{ gap: 16, maxWidth: 820 }}>
        <Section title="Profil">
          <Row title="Nume afișat">
            <input className="input" style={{ width: 240 }} value={c.name} onChange={(e) => api.updateCharacter({ name: e.target.value })} />
          </Row>
          <Row title="Culoare avatar">
            <div className="row">
              {AVATAR_COLORS.map((col) => (
                <button key={col} className={`color-swatch ${col === c.color ? 'on' : ''}`} style={{ background: col }} onClick={() => api.updateCharacter({ color: col })} aria-label={col} />
              ))}
            </div>
          </Row>
          <Row title="Temă">
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

        <Section title="Ziua mea și nutriție">
          <Row title="Repere și mese zilnice" desc="Trezire, ajuns la muncă, mese, culcare: apar pe drum și în desfășurător.">
            <button className="btn" onClick={() => setRoutineOpen(true)}>
              Adaugă repere
            </button>
          </Row>
          <div className="setting-row" style={{ display: 'block' }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <div className="col">
                <span className="strong">Profil nutrițional</span>
                <span className="muted small">Pe baza lui se calculează țintele de calorii și macronutrienți și scorul zilnic.</span>
              </div>
              <Switch checked={!!s.nutrition} onChange={(v) => api.updateSettings({ nutrition: v ? DEFAULT_NUTRITION : undefined })} label="Profil nutrițional" />
            </div>
            {s.nutrition && <NutritionForm value={s.nutrition} onChange={(n) => api.updateSettings({ nutrition: n })} />}
          </div>
        </Section>

        <Section title="Economie">
          <Row title="Valoarea unui credit" desc="Determină câte credite costă un obiectiv. Se aplică și obiectivelor existente.">
            <NumberInput value={s.leiPerCredit} step={0.1} min={0.1} suffix="lei" onChange={(v) => api.updateSettings({ leiPerCredit: Math.max(0.1, v) })} />
          </Row>
          <Row title="Reflecție · Cumpărături" desc="Ore de gândire înainte ca un obiectiv nou să poată primi credite.">
            <NumberInput value={s.cooldownHours.shopping} min={0} suffix="ore" onChange={(v) => setCooldown('shopping', v)} />
          </Row>
          <Row title="Reflecție · Răsfăț">
            <NumberInput value={s.cooldownHours.leisure} min={0} suffix="ore" onChange={(v) => setCooldown('leisure', v)} />
          </Row>
          <Row title="Reflecție · Dezvoltare">
            <NumberInput value={s.cooldownHours.development} min={0} suffix="ore" onChange={(v) => setCooldown('development', v)} />
          </Row>
        </Section>

        <Section title="Provocări bonus">
          <Row title="Frecvență" desc="Șansa zilnică să apară o provocare din lista specială, la o oră aleatorie.">
            <select className="select" style={{ width: 200 }} value={s.bonusFrequency} onChange={(e) => api.updateSettings({ bonusFrequency: e.target.value as BonusFrequency })}>
              <option value="off">Oprite</option>
              <option value="low">Rar (30%)</option>
              <option value="normal">Moderat (50%)</option>
              <option value="high">Des (75%)</option>
              <option value="daily">Zilnic (100%)</option>
            </select>
          </Row>
          <Row title="Multiplicator" desc="De câte ori se înmulțesc punctele și XP-ul la finalizarea unei provocări.">
            <NumberInput value={s.bonusMultiplier} min={2} max={10} suffix="×" onChange={(v) => api.updateSettings({ bonusMultiplier: Math.max(2, Math.min(10, Math.round(v))) })} />
          </Row>
          <Row title="Timp de realizare" desc="Durata unei provocări după ce apare.">
            <NumberInput value={s.bonusWindowHours} min={1} max={72} suffix="ore" onChange={(v) => api.updateSettings({ bonusWindowHours: Math.max(1, Math.min(72, Math.round(v))) })} />
          </Row>
        </Section>

        <Section title="Serie">
          <Row title="Bonus de serie" desc="+1% credite pentru fiecare zi consecutivă cu activitate, maxim +30%.">
            <Switch checked={s.streakBonus} onChange={(v) => api.updateSettings({ streakBonus: v })} label="Bonus de serie" />
          </Row>
          <Row title="Zile libere" desc="În aceste zile poți lua pauză fără să pierzi seria.">
            <div className="weekday-picker">
              {WEEK_ORDER.map((d) => (
                <button
                  key={d}
                  className={s.restDays.includes(d) ? 'on' : ''}
                  onClick={() => api.updateSettings({ restDays: s.restDays.includes(d) ? s.restDays.filter((x) => x !== d) : [...s.restDays, d] })}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="Date și cont">
          <Row
            title="Stocare"
            desc={
              backend.kind === 'server'
                ? 'Date salvate pe server (MariaDB) și sincronizate între dispozitive.'
                : 'Mod local: datele există doar în acest browser. Pornește serverul Docker pentru sincronizare.'
            }
          >
            <span className={`badge ${backend.kind === 'server' ? 'badge-success' : 'badge-warning'}`}>
              {backend.kind === 'server' ? <Cloud size={13} /> : <HardDrive size={13} />} {backend.kind === 'server' ? 'Server' : 'Local'}
            </span>
          </Row>
          {backend.auth.changePassword && (
            <Row title="Parolă" desc="Schimbarea parolei deconectează celelalte dispozitive.">
              <button className="btn" onClick={() => setPwOpen(true)}>
                <KeyRound size={15} /> Schimbă parola
              </button>
            </Row>
          )}
          <Row title="Cont" desc={session.email}>
            <button className="btn" onClick={() => logout()}>
              <LogOut size={15} /> Deconectare
            </button>
          </Row>
          <Row title="Backup" desc="Exportă un fișier JSON cu toate datele tale, sau importă unul exportat anterior.">
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
          <Row title="Resetare" desc="Șterge personajul, sarcinile, creditele și obiectivele.">
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              Resetează tot
            </button>
          </Row>
        </Section>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {routineOpen && <RoutineSetup onClose={() => setRoutineOpen(false)} />}
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
                  api.replaceState(createEmptyState());
                  setConfirmReset(false);
                }}
              >
                Șterge definitiv
              </button>
            </>
          }
        >
          <p className="text-2">Acțiunea nu poate fi anulată. Exportă un backup înainte, dacă vrei să păstrezi istoricul.</p>
        </Modal>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{title}</h2>
      {children}
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
