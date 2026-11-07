import { Gift, LineChart, Mountain, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AuthError, type Session } from '../services/auth';
import type { Backend } from '../services/backend';
import { Landscape } from '../ui/Landscape';

export function AuthView({ backend, onAuth }: { backend: Backend; onAuth: (s: Session) => Promise<void> | void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const auth = backend.auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = mode === 'login' ? await auth.login(email, password) : await auth.register(email, password, name);
      await onAuth(s);
    } catch (err) {
      setError(err instanceof AuthError || err instanceof Error ? err.message : 'A apărut o eroare. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <Landscape hour={new Date().getHours() + new Date().getMinutes() / 60} total={5} done={3} decorative />
        <div className="auth-side-inner">
          <div className="brand">
            <div className="brand-mark">
              <Mountain size={16} />
            </div>
            Ascend
          </div>
          <div className="col" style={{ gap: 28 }}>
            <h1>
              Fiecare zi e un traseu. <em>Fiecare sarcină, un pas spre vârf.</em>
            </h1>
            <div className="col" style={{ gap: 18 }}>
              <Feature icon={<LineChart size={17} />} title="Niveluri pe 8 atribute">
                Sănătate, Intelect, Disciplină, Finanțe și altele cresc cu fiecare pas.
              </Feature>
              <Feature icon={<Wallet size={17} />} title="Credite pentru vârfuri reale">
                Un laptop, un curs, o vacanță: le cucerești cu munca ta.
              </Feature>
              <Feature icon={<Gift size={17} />} title="Provocări surpriză ×5">
                Din lista ta specială, la o oră aleatorie, cu 24 de ore pentru a le prinde.
              </Feature>
            </div>
          </div>
          <p className="muted small">Gândește de două ori înainte să cumperi: fiecare leu are în spate muncă reală.</p>
        </div>
      </aside>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <h1>{mode === 'login' ? 'Autentificare' : 'Creează un cont'}</h1>
            <p className="muted mt-8">{mode === 'login' ? 'Bine ai revenit. Continuă de unde ai rămas.' : 'Durează mai puțin de un minut.'}</p>
          </div>
          <div className="segmented full">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Autentificare
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} disabled={!backend.registration} title={backend.registration ? undefined : 'Înregistrarea este dezactivată pe acest server'}>
              Cont nou
            </button>
          </div>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Nume</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Parolă</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
            {mode === 'register' && <span className="hint">Minimum 8 caractere.</span>}
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} style={{ height: 40 }}>
            {busy ? 'Se procesează…' : mode === 'login' ? 'Intră în cont' : 'Creează contul'}
          </button>
          <p className="hint" style={{ textAlign: 'center' }}>
            {backend.kind === 'server'
              ? 'Datele sunt salvate pe serverul tău și sincronizate pe toate dispozitivele.'
              : 'Mod local: contul și datele rămân doar în acest browser.'}
          </p>
        </form>
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="auth-feature">
      <div className="ic">{icon}</div>
      <div>
        <div className="strong">{title}</div>
        <div className="muted">{children}</div>
      </div>
    </div>
  );
}
