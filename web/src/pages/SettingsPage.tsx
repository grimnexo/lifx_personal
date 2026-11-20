import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from '../context';
import { plural } from '../constants';
import type { Group, Settings } from '../types';
import { Field, PageTitle, Switch, btnPrimary, btnSmall, card, input } from '../components/ui';

interface Form {
  broadcast: string;
  ips: string;
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

const toForm = (s: Settings): Form => ({
  broadcast: s.broadcast,
  ips: s.ips.join(', '),
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
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  const field = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

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
      ips: list(f.ips),
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
      <form className="grid items-start gap-5 lg:grid-cols-2" onSubmit={save}>
        <section className={card} aria-labelledby="network-head">
          <h2 id="network-head" className="text-lg font-semibold">
            Network
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
          <Field label="Broadcast address" hint="Use your subnet’s broadcast (e.g. 192.168.1.255) if lights aren’t found.">
            <input className={input} value={f.broadcast} onChange={field('broadcast')} />
          </Field>
          <Field label="Extra light IPs" hint="Comma-separated. Useful for lights on another subnet or when broadcasts are blocked.">
            <input className={input} value={f.ips} placeholder="192.168.1.50, 192.168.1.51" onChange={field('ips')} />
          </Field>
          <Field label="Scan ranges" hint="Optional, comma-separated CIDR ranges. Leave blank to scan this server’s own /24.">
            <input className={input} value={f.scan} placeholder="10.69.1.0/24" onChange={field('scan')} />
          </Field>
        </section>

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

        <section className={card} aria-labelledby="control-head">
          <h2 id="control-head" className="text-lg font-semibold">
            Light behavior
          </h2>
          <Field label="Fade time when changing (seconds)" hint="How long lights take to move to a new color or brightness. 0 is instant.">
            <input type="number" min={0} step={0.1} className={input} value={f.fade} onChange={field('fade')} />
          </Field>
        </section>

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

        <GroupsCard />

        <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
          <div className="mr-auto grid gap-0.5">
            <small role="status" className={msg?.ok ? 'text-ok' : 'text-danger'}>
              {msg?.text}
            </small>
            {version && <small className="text-mut">Version {version}</small>}
          </div>
          {dirty && (
            <button type="button" className={btnSmall} onClick={() => setF(saved)}>
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
    <section className={`${card} lg:col-span-2`} aria-labelledby="groups-head">
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
