import { useState, type FormEvent } from 'react';
import { useAuth, type User } from '../auth';
import { ACCENTS, ACCENT_INFO, type Appearance } from '../theme';
import { Badge, Field, PageTitle, btnPrimary, btnSmall, card, input } from '../components/ui';

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
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid gap-5">
          <ProfileCard />
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
        <div className="grid gap-5">
          <AppearanceCard user={user} />
        </div>
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

function AppearanceCard({ user }: { user: User }) {
  const { saveAccount } = useAuth();
  const [msg, setMsg] = useState<Msg | null>(null);

  const pick = async (body: Partial<Appearance>) => {
    const r = await saveAccount(body);
    setMsg(r.ok ? null : { ok: false, text: r.error ?? 'Could not save.' });
  };

  return (
    <section className={card} aria-labelledby="appearance-head">
      <h2 id="appearance-head" className="text-lg font-semibold">
        Appearance
      </h2>
      <Choice
        label="Color scheme"
        value={user.theme}
        options={[
          ['auto', 'Auto'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ]}
        onPick={(theme) => void pick({ theme })}
      />
      <Choice
        label="Contrast"
        value={user.contrast}
        options={[
          ['standard', 'Standard'],
          ['high', 'High'],
        ]}
        onPick={(contrast) => void pick({ contrast })}
      />
      <Choice
        label="Background"
        value={user.palette}
        options={[
          ['default', 'Default'],
          ['paper', 'Paper'],
          ['mist', 'Mist'],
          ['sage', 'Sage'],
          ['dusk', 'Dusk'],
        ]}
        onPick={(palette) => void pick({ palette })}
      />
      <div className="grid gap-2">
        <span className="text-[.9rem] font-medium">Accent color</span>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a}
              aria-label={`${ACCENT_INFO[a].label} accent`}
              aria-pressed={user.accent === a}
              title={ACCENT_INFO[a].label}
              onClick={() => void pick({ accent: a })}
              className={`size-9 cursor-pointer rounded-full border-2 ${user.accent === a ? 'border-ink' : 'border-transparent'}`}
              style={{ background: ACCENT_INFO[a].swatch }}
            />
          ))}
        </div>
      </div>
      <Choice
        label="Navigation on desktop"
        value={user.layout}
        options={[
          ['top', 'Top bar'],
          ['side', 'Sidebar'],
        ]}
        onPick={(layout) => void pick({ layout })}
      />
      <Choice
        label="Text size"
        value={user.textSize}
        options={[
          ['small', 'Small'],
          ['default', 'Default'],
          ['large', 'Large'],
        ]}
        onPick={(textSize) => void pick({ textSize })}
      />
      <Choice
        label="Motion"
        value={user.motion}
        options={[
          ['system', 'Follow system'],
          ['reduce', 'Reduce'],
        ]}
        onPick={(motion) => void pick({ motion })}
      />
      <Status msg={msg} />
    </section>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (v: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-[.9rem] font-medium">{label}</span>
      <div role="group" aria-label={label} className="inline-flex w-fit flex-wrap overflow-hidden rounded-lg border border-line">
        {options.map(([v, text]) => (
          <button
            key={v}
            aria-pressed={value === v}
            className={`cursor-pointer border-0 px-4 py-1.5 text-[.9rem] ${value === v ? 'bg-acc font-semibold text-on-acc' : 'bg-card text-ink hover:bg-soft'}`}
            onClick={() => onPick(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
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
