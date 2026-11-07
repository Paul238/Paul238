import { Gift, LineChart, Mountain, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AuthError, localAuth, type Session } from '../services/auth';

export function AuthView({ onAuth }: { onAuth: (s: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
      const s = mode === 'login' ? await localAuth.login(email, password) : await localAuth.register(email, password, name);
      onAuth(s);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'A apărut o eroare. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand">
          <div className="brand-mark">
            <Mountain size={16} />
          </div>
          Ascend
        </div>
        <div className="col gap-16" style={{ gap: 28 }}>
          <h1>Munca de azi devine progresul și recompensele de mâine.</h1>
          <div className="col" style={{ gap: 18 }}>
            <Feature icon={<LineChart size={17} />} title="Niveluri pe 8 atribute">
              Sănătate, Intelect, Disciplină, Finanțe și altele cresc cu fiecare sarcină bifată.
            </Feature>
            <Feature icon={<Wallet size={17} />} title="Credite pentru obiective reale">
              Strângi credite și le aloci obiectivelor: un laptop, un curs, o vacanță.
            </Feature>
            <Feature icon={<Gift size={17} />} title="Provocări surpriză ×5">
              Din lista ta specială primești aleatoriu provocări cu termen de 24 de ore.
            </Feature>
          </div>
        </div>
        <p className="muted small">Gândește de două ori înainte să cumperi: fiecare leu are în spate muncă reală.</p>
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
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
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
            Versiunea curentă păstrează contul și datele local, pe acest dispozitiv.
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
