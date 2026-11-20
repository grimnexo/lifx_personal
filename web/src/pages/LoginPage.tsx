import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { btnPrimary, input, Field } from '../components/ui';

const features = [
  'Control every LIFX bulb on your network from one place',
  'Group lights, save presets, and run effects like breathe or candle flicker',
  'Schedules that follow the clock or sunrise and sunset, run by your own server',
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [username, setUsername] = useState('');
  const [method, setMethod] = useState<'password' | 'pin'>('password');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await signIn(username.trim(), secret, method);
    setBusy(false);
    if (err) {
      setError(err);
      setSecret('');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="mx-auto grid w-full max-w-[960px] items-center gap-10 md:grid-cols-2">
        <section aria-labelledby="landing-head" className="grid gap-5">
          <span aria-hidden="true" className="size-12 rounded-xl bg-acc" />
          <h1 id="landing-head" className="text-[2.2rem] leading-tight font-bold tracking-tight">
            Your lights, in one place.
          </h1>
          <ul className="m-0 grid list-none gap-3 p-0 text-mut">
            {features.map((f) => (
              <li key={f} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-acc" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="signin-head" className="grid gap-5 rounded-[var(--radius)] border border-line bg-card p-6 shadow-card">
          <h2 id="signin-head" className="text-xl font-semibold">
            Sign in
          </h2>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Username">
              <input
                className={input}
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>

            <div role="group" aria-label="Sign-in method" className="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
              {(
                [
                  ['password', 'Password'],
                  ['pin', 'PIN'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => {
                    setMethod(m);
                    setSecret('');
                    setError('');
                  }}
                  className={`cursor-pointer border-0 py-2 text-[.9rem] ${method === m ? 'bg-acc font-semibold text-on-acc' : 'bg-card text-ink hover:bg-soft'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Field label={method === 'pin' ? 'PIN' : 'Password'}>
              <input
                type="password"
                className={input}
                autoComplete={method === 'pin' ? 'off' : 'current-password'}
                inputMode={method === 'pin' ? 'numeric' : undefined}
                required
                value={secret}
                onChange={(e) => setSecret(method === 'pin' ? e.target.value.replace(/\D/g, '') : e.target.value)}
              />
            </Field>

            {error && (
              <p role="alert" className="m-0 text-[.9rem] text-danger">
                {error}
              </p>
            )}

            <button type="submit" className={btnPrimary} disabled={busy || !username || !secret}>
              {busy ? 'Signing in\u2026' : 'Sign in'}
            </button>
            {import.meta.env.DEV && (
              <p className="m-0 text-[.8rem] text-mut">Development account: test / test. Change it under Profile.</p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
