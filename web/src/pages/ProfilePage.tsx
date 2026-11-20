import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ACCENTS, getAccent, getThemeMode, type Accent, type ThemeMode } from '../theme';
import { Badge, Field, PageTitle, btnPrimary, btnSmall, card, input } from '../components/ui';

const swatch: Record<Accent, string> = {
  blue: '#2563eb',
  teal: '#0f766e',
  violet: '#6d4bd6',
  amber: '#b7791f',
  rose: '#be3455',
};

const modes: [ThemeMode, string][] = [
  ['auto', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

interface Msg {
  ok: boolean;
  text: string;
}

function Status({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <small role="status" className={`block ${msg.ok ? 'text-ok' : 'text-danger'}`}>
      {msg.text}
    </small>
  );
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageTitle title="Profile" subtitle={`Signed in as ${user.username}`} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ProfileCard />
        <AppearanceCard />
        <PasswordCard />
        <PinCard />
        <section className={card} aria-labelledby="session-head">
          <h2 id="session-head" className="text-lg font-semibold">
            Session
          </h2>
          <p className="m-0 text-mut">Sign out on this device. You can sign back in with your password or PIN.</p>
          <div>
            <button className={btnSmall} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function ProfileCard() {
  const { user, saveAccount } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [msg, setMsg] = useState<Msg | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await saveAccount({ name: name.trim() });
    setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error ?? 'Could not save.' });
  };

  return (
    <section className={card} aria-labelledby="profile-head">
      <h2 id="profile-head" className="text-lg font-semibold">
        Account
      </h2>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Display name">
          <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Username">
          <input className={`${input} text-mut`} value={user?.username ?? ''} readOnly />
        </Field>
        <div className="flex items-center gap-3">
          <button type="submit" className={btnPrimary} disabled={!name.trim()}>
            Save name
          </button>
          <Status msg={msg} />
        </div>
      </form>
    </section>
  );
}

function AppearanceCard() {
  const { user, saveAccount } = useAuth();
  const [msg, setMsg] = useState<Msg | null>(null);
  const mode = user?.theme ?? getThemeMode();
  const accent = user?.accent ?? getAccent();

  const pick = async (body: { theme?: ThemeMode; accent?: Accent }) => {
    const r = await saveAccount(body);
    setMsg(r.ok ? null : { ok: false, text: r.error ?? 'Could not save.' });
  };

  return (
    <section className={card} aria-labelledby="appearance-head">
      <h2 id="appearance-head" className="text-lg font-semibold">
        Appearance
      </h2>
      <div className="grid gap-2">
        <span className="text-[.9rem] font-medium">Theme</span>
        <div role="group" aria-label="Theme" className="inline-flex w-fit overflow-hidden rounded-lg border border-line">
          {modes.map(([m, label]) => (
            <button
              key={m}
              aria-pressed={mode === m}
              className={`cursor-pointer border-0 px-4 py-1.5 text-[.9rem] ${mode === m ? 'bg-acc font-semibold text-on-acc' : 'bg-card text-ink hover:bg-soft'}`}
              onClick={() => void pick({ theme: m })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-[.9rem] font-medium">Accent color</span>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a}
              aria-label={`${a} accent`}
              aria-pressed={accent === a}
              title={a}
              onClick={() => void pick({ accent: a })}
              className={`size-9 cursor-pointer rounded-full border-2 ${accent === a ? 'border-ink' : 'border-transparent'}`}
              style={{ background: swatch[a] }}
            />
          ))}
        </div>
      </div>
      <Status msg={msg} />
    </section>
  );
}

function PasswordCard() {
  const { saveAccount } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<Msg | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.next.length < 4) return setMsg({ ok: false, text: 'Use at least 4 characters.' });
    if (form.next !== form.confirm) return setMsg({ ok: false, text: 'The new passwords don\u2019t match.' });
    const r = await saveAccount({ currentPassword: form.current, newPassword: form.next });
    if (r.ok) {
      setForm({ current: '', next: '', confirm: '' });
      setMsg({ ok: true, text: 'Password changed.' });
    } else {
      setMsg({ ok: false, text: r.error ?? 'Could not change the password.' });
    }
  };

  return (
    <section className={card} aria-labelledby="password-head">
      <h2 id="password-head" className="text-lg font-semibold">
        Password
      </h2>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Current password">
          <input type="password" autoComplete="current-password" className={input} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        </Field>
        <Field label="New password">
          <input type="password" autoComplete="new-password" className={input} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" autoComplete="new-password" className={input} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <button type="submit" className={btnPrimary} disabled={!form.current || !form.next}>
            Change password
          </button>
          <Status msg={msg} />
        </div>
      </form>
    </section>
  );
}

function PinCard() {
  const { user, saveAccount } = useAuth();
  const [form, setForm] = useState({ current: '', pin: '' });
  const [msg, setMsg] = useState<Msg | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await saveAccount({ currentPassword: form.current, pin: form.pin });
    if (r.ok) {
      setForm({ current: '', pin: '' });
      setMsg({ ok: true, text: form.pin ? 'PIN saved.' : 'PIN removed.' });
    } else {
      setMsg({ ok: false, text: r.error ?? 'Could not save the PIN.' });
    }
  };

  return (
    <section className={card} aria-labelledby="pin-head">
      <h2 id="pin-head" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        PIN sign-in
        <Badge tone={user?.hasPin ? 'ok' : 'off'}>{user?.hasPin ? 'On' : 'Off'}</Badge>
      </h2>
      <p className="m-0 text-[.9rem] text-mut">Sign in with a 4 to 8 digit PIN instead of your password.</p>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Current password">
          <input type="password" autoComplete="current-password" className={input} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        </Field>
        <Field label={user?.hasPin ? 'New PIN' : 'PIN'}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            className={input}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btnPrimary} disabled={!form.current || form.pin.length < 4}>
            {user?.hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
          {user?.hasPin && (
            <button
              type="button"
              className={btnSmall}
              disabled={!form.current}
              onClick={async () => {
                const r = await saveAccount({ currentPassword: form.current, pin: '' });
                setForm({ current: '', pin: '' });
                setMsg(r.ok ? { ok: true, text: 'PIN removed.' } : { ok: false, text: r.error ?? 'Could not remove the PIN.' });
              }}
            >
              Remove PIN
            </button>
          )}
          <Status msg={msg} />
        </div>
      </form>
    </section>
  );
}
