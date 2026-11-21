import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from '../context';
import { plural } from '../constants';
import { APP_ICONS, APP_ICON_LABELS, DEFAULT_LABEL, LABEL_MAX, brandLabel, iconFromFile, updateBranding, useBranding, type AppIcon } from '../branding';
import { BrandTile } from '../components/BrandTile';
import type { Group, LightIp, Settings } from '../types';
import { Field, PageTitle, Switch, btnPrimary, btnSmall, card, input } from '../components/ui';

interface Form {
  broadcast: string;
  scan: string;
  poll: string;
  offline: string;
  fade: string;
  lat: string;
  lon: string;
}

interface Msg {
  ok: boolean;
  text: string;
}

const TABS = [
  { id: 'network', label: 'Network' },
  { id: 'connection', label: 'Connection' },
  { id: 'behavior', label: 'Light behavior' },
  { id: 'location', label: 'Location' },
  { id: 'groups', label: 'Groups' },
  { id: 'application', label: 'Application' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const BROADCAST_PRESETS = [
  { value: '255.255.255.255', label: '255.255.255.255 (any network, default)' },
  { value: '192.168.0.255', label: '192.168.0.255 (192.168.0.x)' },
  { value: '192.168.1.255', label: '192.168.1.255 (192.168.1.x)' },
  { value: '192.168.2.255', label: '192.168.2.255 (192.168.2.x)' },
  { value: '10.0.0.255', label: '10.0.0.255 (10.0.0.x)' },
  { value: '10.0.1.255', label: '10.0.1.255 (10.0.1.x)' },
];
const isCustomBroadcast = (v: string) => !BROADCAST_PRESETS.some((p) => p.value === v);

const PAGE_SIZE = 10;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const isIpv4 = (s: string) => {
  const m = IPV4.exec(s);
  return !!m && m.slice(1).every((o) => +o <= 255);
};

const toForm = (s: Settings): Form => ({
  broadcast: s.broadcast,
  scan: s.scan.join(', '),
  poll: String(s.poll),
  offline: s.offline_after == null ? '' : String(s.offline_after),
  fade: String(s.transition),
  lat: s.lat == null ? '' : String(s.lat),
  lon: s.lon == null ? '' : String(s.lon),
});

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function problem(f: Form): string | null {
  if (!f.broadcast.trim()) return 'Enter a broadcast address.';
  if (!(+f.poll >= 1)) return 'Refresh interval must be at least 1 second.';
  if (f.offline.trim() && !(+f.offline >= 3)) return 'Offline timeout must be at least 3 seconds, or blank for automatic.';
  if (f.fade.trim() === '' || !(+f.fade >= 0)) return 'Fade time can\u2019t be negative.';
  if ((f.lat.trim() === '') !== (f.lon.trim() === '')) return 'Enter both latitude and longitude, or leave both blank.';
  if (f.lat.trim() && !(Math.abs(+f.lat) <= 90)) return 'Latitude must be between -90 and 90.';
  if (f.lon.trim() && !(Math.abs(+f.lon) <= 180)) return 'Longitude must be between -180 and 180.';
  return null;
}

export function SettingsPage() {
  const { loaded } = useApp();
  if (!loaded) return <p className="text-mut">Loading settings&hellip;</p>;
  return <SettingsForm />;
}

function SettingsForm() {
  const { settings, version, diag, lights, saveSettings, refresh } = useApp();
  const [saved, setSaved] = useState<Form>(() => toForm(settings));
  const [f, setF] = useState<Form>(saved);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [tab, setTab] = useState<TabId>('network');
  const [customBroadcast, setCustomBroadcast] = useState(() => isCustomBroadcast(settings.broadcast));
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  const field = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const chooseBroadcast = (e: ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'custom') return setCustomBroadcast(true);
    setCustomBroadcast(false);
    setF((x) => ({ ...x, broadcast: e.target.value }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setMsg({ ok: false, text: 'This browser can\u2019t read your location. Enter it manually.' });
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) })),
      () => setMsg({ ok: false, text: 'Location access was denied. Enter it manually.' }),
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const err = problem(f);
    if (err) return setMsg({ ok: false, text: err });
    const r = await saveSettings({
      broadcast: f.broadcast.trim(),
      scan: list(f.scan),
      poll: +f.poll,
      offline_after: f.offline.trim() ? +f.offline : null,
      transition: +f.fade,
      lat: f.lat.trim() ? +f.lat : null,
      lon: f.lon.trim() ? +f.lon : null,
    });
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? 'Could not save settings.' });
    setSaved(f);
    await refresh();
    setMsg({ ok: true, text: 'Settings saved.' });
  };

  return (
    <>
      <PageTitle title="Settings" subtitle="How this server finds, refreshes and controls your lights." />
      <div role="tablist" aria-label="Settings categories" className="mb-5 flex flex-wrap gap-x-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="settings-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-3 py-2 text-[.95rem] ${
              tab === t.id ? 'border-acc font-semibold text-ink' : 'border-transparent text-mut hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="grid gap-5" onSubmit={save}>
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tab-${tab}`}
          className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]"
        >
          {tab === 'network' && (
            <section className={`${card} [grid-column:1/-1]`} aria-labelledby="network-head">
              <h2 id="network-head" className="text-lg font-semibold">
                Light discovery
              </h2>
              {diag && (
                <dl className="m-0 grid grid-cols-3 gap-3 rounded-lg bg-soft p-3 text-[.85rem]">
                  <div>
                    <dt className="text-mut">This server</dt>
                    <dd className="m-0 font-semibold tabular-nums">{diag.local_ip ?? 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-mut">Lights found</dt>
                    <dd className="m-0 font-semibold tabular-nums">{lights.length}</dd>
                  </div>
                  <div>
                    <dt className="text-mut">Replies</dt>
                    <dd className="m-0 font-semibold tabular-nums">{diag.replies}</dd>
                  </div>
                </dl>
              )}
              <Field label="Broadcast address" hint="Where this server sends its discovery message. Pick your subnet if lights aren’t found.">
                <select className={input} value={customBroadcast ? 'custom' : f.broadcast} onChange={chooseBroadcast}>
                  {BROADCAST_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </Field>
              {customBroadcast && (
                <Field label="Custom broadcast address" hint="For example 172.16.5.255.">
                  <input className={input} value={f.broadcast} placeholder="192.168.1.255" onChange={field('broadcast')} />
                </Field>
              )}
              <Field label="Scan ranges" hint="Optional, comma-separated CIDR ranges. Leave blank to scan this server’s own /24.">
                <input className={input} value={f.scan} placeholder="10.69.1.0/24" onChange={field('scan')} />
              </Field>
            </section>
          )}

          {tab === 'network' && <LightAddressesCard />}

          {tab === 'connection' && (
            <section className={card} aria-labelledby="connection-head">
              <h2 id="connection-head" className="text-lg font-semibold">
                Connection
              </h2>
              <Field label="Refresh every (seconds)" hint="How often the server asks lights for their current state.">
                <input type="number" min={1} step={1} className={input} value={f.poll} onChange={field('poll')} />
              </Field>
              <Field label="Mark offline after (seconds)" hint="Leave blank to calculate this from the refresh interval.">
                <input
                  type="number"
                  min={3}
                  step={1}
                  className={input}
                  placeholder="Automatic"
                  value={f.offline}
                  onChange={field('offline')}
                />
              </Field>
            </section>
          )}

          {tab === 'behavior' && (
            <section className={card} aria-labelledby="control-head">
              <h2 id="control-head" className="text-lg font-semibold">
                Light behavior
              </h2>
              <Field label="Fade time when changing (seconds)" hint="How long lights take to move to a new color or brightness. 0 is instant.">
                <input type="number" min={0} step={0.1} className={input} value={f.fade} onChange={field('fade')} />
              </Field>
            </section>
          )}

          {tab === 'location' && (
            <section className={card} aria-labelledby="location-head">
              <h2 id="location-head" className="text-lg font-semibold">
                Location
              </h2>
              <p className="m-0 text-[.9rem] text-mut">
                Sunrise and sunset schedules use these coordinates. Sun times are calculated on this server, so no internet is needed.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Latitude">
                  <input type="number" step="any" className={input} placeholder="e.g. 40.71" value={f.lat} onChange={field('lat')} />
                </Field>
                <Field label="Longitude">
                  <input type="number" step="any" className={input} placeholder="e.g. -74.01" value={f.lon} onChange={field('lon')} />
                </Field>
              </div>
              <div>
                <button type="button" className={btnSmall} onClick={useMyLocation}>
                  Use my current location
                </button>
              </div>
            </section>
          )}

          {tab === 'groups' && <GroupsCard />}
          {tab === 'application' && <ApplicationCard />}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="mr-auto grid gap-0.5">
            <small role="status" className={msg?.ok ? 'text-ok' : 'text-danger'}>
              {msg?.text}
            </small>
            {version && <small className="text-mut">Version {version}</small>}
          </div>
          {dirty && (
            <button
              type="button"
              className={btnSmall}
              onClick={() => {
                setF(saved);
                setCustomBroadcast(isCustomBroadcast(saved.broadcast));
              }}
            >
              Discard changes
            </button>
          )}
          <button type="submit" className={btnPrimary} disabled={!dirty}>
            Save settings
          </button>
        </div>
      </form>
    </>
  );
}

function ApplicationCard() {
  const branding = useBranding();
  const isDefault = branding.icon === 'bulb' && branding.label === DEFAULT_LABEL;
  const fileRef = useRef<HTMLInputElement>(null);
  const [iconErr, setIconErr] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const customIcon = await iconFromFile(file);
      setIconErr(updateBranding({ customIcon, icon: 'custom' }) ? null : 'Browser storage is full. Try a smaller image.');
    } catch (err) {
      setIconErr(err instanceof Error ? err.message : 'That image could not be used.');
    }
  };

  return (
    <section className={card} aria-labelledby="application-head">
      <div>
        <h2 id="application-head" className="text-lg font-semibold">
          Application
        </h2>
        <p className="m-0 text-[.9rem] text-mut">How the app is branded in the navigation bar. Saved on this device and applied right away.</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-soft p-3">
        <BrandTile icon={branding.icon} customIcon={branding.customIcon} />
        <span className="min-w-0 truncate font-bold">{brandLabel(branding)}</span>
      </div>
      <Field label="Navigation label" hint={`Shown next to the icon. Up to ${LABEL_MAX} characters.`}>
        <input
          className={input}
          maxLength={LABEL_MAX}
          placeholder={DEFAULT_LABEL}
          value={branding.label}
          onChange={(e) => updateBranding({ label: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      </Field>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1.5 text-[.85rem] text-mut">App icon</legend>
        <div className="flex flex-wrap gap-2">
          {APP_ICONS.map((icon: AppIcon) => {
            const on = branding.icon === icon;
            return (
              <button
                key={icon}
                type="button"
                aria-pressed={on}
                aria-label={APP_ICON_LABELS[icon]}
                title={APP_ICON_LABELS[icon]}
                onClick={() => updateBranding({ icon })}
                className={`grid size-11 cursor-pointer place-items-center rounded-xl border-2 bg-card ${
                  on ? 'border-acc text-acc' : 'border-line text-mut hover:text-ink'
                }`}
              >
                <BrandTile icon={icon} />
              </button>
            );
          })}
          {branding.customIcon && (
            <button
              type="button"
              aria-pressed={branding.icon === 'custom'}
              aria-label="Uploaded icon"
              title="Uploaded icon"
              onClick={() => updateBranding({ icon: 'custom' })}
              className={`grid size-11 cursor-pointer place-items-center rounded-xl border-2 bg-card ${
                branding.icon === 'custom' ? 'border-acc text-acc' : 'border-line text-mut hover:text-ink'
              }`}
            >
              <BrandTile icon="custom" customIcon={branding.customIcon} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmall} onClick={() => fileRef.current?.click()}>
            Upload icon
          </button>
          {branding.customIcon && (
            <button type="button" className={btnSmall} onClick={() => updateBranding({ customIcon: null })}>
              Remove uploaded icon
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload app icon"
            onChange={onFile}
          />
        </div>
        {iconErr && (
          <small role="alert" className="text-danger">
            {iconErr}
          </small>
        )}
        <small className="text-mut">Uploads are cropped to a square and stored in this browser.</small>
      </fieldset>
      <div>
        <button
          type="button"
          className={btnSmall}
          disabled={isDefault}
          onClick={() => updateBranding({ icon: 'bulb', label: DEFAULT_LABEL })}
        >
          Reset to default
        </button>
      </div>
    </section>
  );
}

function LightAddressesCard() {
  const { settings, saveSettings, refresh, ask } = useApp();
  const records = settings.ips;
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? records.filter((r) => r.ip.includes(q) || r.name.toLowerCase().includes(q)) : records),
    [records, q],
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const persist = async (next: LightIp[]) => {
    setBusy(true);
    const r = await saveSettings({ ips: next });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? 'Could not save light addresses.');
      return false;
    }
    setErr(null);
    await refresh();
    return true;
  };

  const add = async () => {
    const address = ip.trim();
    if (!isIpv4(address)) return setErr('Enter a valid IPv4 address, like 192.168.1.50.');
    if (records.some((r) => r.ip === address)) return setErr('That address is already in the list.');
    if (await persist([...records, { ip: address, name: name.trim() }])) {
      setIp('');
      setName('');
    }
  };

  const remove = (r: LightIp) =>
    ask(`Remove ${r.name || r.ip} from the light addresses?`, 'Remove', () =>
      void persist(records.filter((x) => x.ip !== r.ip)),
    );

  return (
    <section className={`${card} [grid-column:1/-1]`} aria-labelledby="addresses-head">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="addresses-head" className="text-lg font-semibold">
            Light addresses
          </h2>
          <p className="m-0 text-[.9rem] text-mut">
            {records.length ? `${plural(records.length, 'address')} saved` : 'Lights you want found at a specific IP address.'}
          </p>
        </div>
        <button
          type="button"
          className={btnSmall}
          aria-expanded={open}
          aria-controls="addresses-body"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide addresses' : 'Manage addresses'}
        </button>
      </div>

      {open && (
        <div id="addresses-body" className="grid gap-3">
          <p className="m-0 text-[.9rem] text-mut">
            Use this for lights on another subnet or when broadcasts are blocked. Names are only shown here.
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              className={input}
              inputMode="decimal"
              placeholder="192.168.1.50"
              aria-label="Light IP address"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <input
              className={input}
              maxLength={60}
              placeholder="Internal name, e.g. Kitchen lamp"
              aria-label="Internal name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <button type="button" className={btnPrimary} disabled={busy || !ip.trim()} onClick={() => void add()}>
              Add light
            </button>
          </div>
          {err && (
            <small role="alert" className="text-danger">
              {err}
            </small>
          )}
          <input
            type="search"
            className={input}
            placeholder="Search by name or IP"
            aria-label="Search light addresses"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-[.9rem]">
              <thead className="bg-soft text-[.8rem] text-mut">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    IP address
                  </th>
                  <th scope="col" className="w-px px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ip} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{r.name || <span className="text-mut">Unnamed</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{r.ip}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={btnSmall}
                        disabled={busy}
                        aria-label={`Remove ${r.name || r.ip}`}
                        onClick={() => remove(r)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="m-0 border-t border-line px-3 py-4 text-center text-mut">
                {records.length === 0 ? 'No addresses yet.' : 'No addresses match your search.'}
              </p>
            )}
          </div>
          {matches.length > PAGE_SIZE && (
            <nav
              aria-label="Light address pages"
              className="flex flex-wrap items-center justify-between gap-2 text-[.85rem] text-mut"
            >
              <span>
                Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, matches.length)} of {matches.length}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className={btnSmall} disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  Previous
                </button>
                <span>
                  Page {current} of {pages}
                </span>
                <button
                  type="button"
                  className={btnSmall}
                  disabled={current >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

function GroupsCard() {
  const { groups, lights, schedules, updateGroups, updateSchedules, ask } = useApp();
  const [newGroup, setNewGroup] = useState('');

  const editGroup = (gid: string, fn: (g: Group) => Group) =>
    updateGroups((gs) => gs.map((x) => (x.id === gid ? fn(x) : x)));

  const removeGroup = (gid: string) => {
    updateGroups((gs) => gs.filter((x) => x.id !== gid));
    if (schedules.some((s) => s.action.target === gid))
      updateSchedules((ss) => ss.filter((s) => s.action.target !== gid));
  };

  const deleteGroup = (g: Group) => {
    const name = g.name || 'this group';
    const np = (g.presets ?? []).length;
    const ns = schedules.filter((s) => s.action.target === g.id).length;
    const final = () => ask(`Delete the group \u201c${name}\u201d? This can\u2019t be undone.`, 'Yes, delete', () => removeGroup(g.id));
    if (!np && !ns) return final();
    const parts = [np ? plural(np, 'preset') : '', ns ? plural(ns, 'schedule') : ''].filter(Boolean).join(' and ');
    ask(
      `Warning: \u201c${name}\u201d has ${parts} that use it. Deleting the group will permanently delete all of its presets and every schedule that targets it. They will be lost for good.`,
      'Yes, continue',
      final,
    );
  };

  const addGroup = () => {
    const n = newGroup.trim();
    if (!n) return;
    updateGroups((gs) => [...gs, { id: 'g' + Date.now().toString(36), name: n, members: [] }]);
    setNewGroup('');
  };

  return (
    <section className={`${card} [grid-column:1/-1]`} aria-labelledby="groups-head">
      <div>
        <h2 id="groups-head" className="text-lg font-semibold">
          Groups
        </h2>
        <p className="m-0 text-[.9rem] text-mut">Control several lights together. Group changes save as you make them.</p>
      </div>
      {groups.length === 0 && <p className="m-0 text-mut">No groups yet.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="grid content-start gap-2.5 rounded-xl border border-line p-3">
            <div className="flex gap-2">
              <input
                className={`${input} flex-1`}
                aria-label="Group name"
                value={g.name}
                onChange={(e) => editGroup(g.id, (x) => ({ ...x, name: e.target.value }))}
              />
              <button type="button" className={btnSmall} onClick={() => deleteGroup(g)}>
                Delete
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 text-[.9rem]">
              <span>
                Hide from Lights page <small className="text-mut">(still works in schedules)</small>
              </span>
              <Switch small checked={!!g.hidden} onChange={(hidden) => editGroup(g.id, (x) => ({ ...x, hidden }))} label={`Hide group ${g.name}`} />
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
              {lights.length === 0 && <small className="text-mut">No lights found yet.</small>}
              {lights.map((l) => (
                <label key={l.mac} className="flex items-center gap-1.5 text-[.9rem]">
                  <input
                    type="checkbox"
                    checked={g.members.includes(l.mac)}
                    onChange={(e) =>
                      editGroup(g.id, (x) => ({
                        ...x,
                        members: e.target.checked
                          ? [...new Set([...x.members, l.mac])]
                          : x.members.filter((m) => m !== l.mac),
                      }))
                    }
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className={`${input} max-w-xs flex-1`}
          placeholder="New group name"
          aria-label="New group name"
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGroup()}
        />
        <button type="button" className={btnSmall} onClick={addGroup}>
          Add group
        </button>
      </div>
    </section>
  );
}
