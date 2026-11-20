import { useState } from 'react';
import { useApp } from '../context';
import { plural } from '../constants';
import type { Group } from '../types';
import { btnPrimary, btnSmall, Fieldset, input, labelRow, Modal, Switch } from './ui';

export function SettingsDialog() {
  const { settingsOpen, closeSettings } = useApp();
  return (
    <Modal open={settingsOpen} onClose={closeSettings} labelledBy="setTitle">
      {settingsOpen && <SettingsForm />}
    </Modal>
  );
}

function SettingsForm() {
  const { settings, version, diag, groups, lights, schedules, updateGroups, updateSchedules, saveSettings, refresh, closeSettings, ask } =
    useApp();
  const [f, setF] = useState({
    broadcast: settings.broadcast,
    ips: settings.ips.join(', '),
    scan: settings.scan.join(', '),
    lat: String(settings.lat ?? ''),
    lon: String(settings.lon ?? ''),
    poll: String(settings.poll),
    tr: String(settings.transition),
  });
  const [msg, setMsg] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const field = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    const r = await saveSettings({
      broadcast: f.broadcast,
      ips: f.ips.split(','),
      scan: f.scan.split(','),
      lat: f.lat,
      lon: f.lon,
      poll: +f.poll,
      transition: +f.tr,
    });
    if (!r.ok) return setMsg(r.error ?? 'Save failed.');
    await refresh();
    setMsg('Saved.');
    window.setTimeout(closeSettings, 700);
  };

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
    <>
      <h3 id="setTitle" className="mb-3.5 text-[1.3rem] font-semibold">
        Settings
      </h3>

      <Fieldset legend="Groups">
        {groups.map((g) => (
          <div key={g.id} className="mb-3 grid gap-2">
            <div className="flex gap-2">
              <input
                className={`${input} flex-1`}
                aria-label="Group name"
                value={g.name}
                onChange={(e) => editGroup(g.id, (x) => ({ ...x, name: e.target.value }))}
              />
              <button className={btnSmall} onClick={() => deleteGroup(g)}>
                Delete
              </button>
            </div>
            <div className="flex items-start gap-2 text-[.9rem]">
              <Switch small checked={!!g.hidden} onChange={(hidden) => editGroup(g.id, (x) => ({ ...x, hidden }))} label={`Hidden group ${g.name}`} />
              <span>
                Hidden group <small className="text-mut">(no card on the page; still works in schedules)</small>
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1">
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
        {groups.length === 0 && <small className="text-mut">No groups yet.</small>}
        <div className="flex gap-2">
          <input
            className={`${input} flex-1`}
            placeholder="New group name"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGroup()}
          />
          <button className={btnSmall} onClick={addGroup}>
            Add group
          </button>
        </div>
      </Fieldset>

      <Fieldset legend="Network">
        <label className={labelRow}>
          Broadcast address
          <input className={input} value={f.broadcast} onChange={field('broadcast')} />
        </label>
        <small className="text-mut">Use your subnet&rsquo;s broadcast (e.g. 192.168.1.255) if lights aren&rsquo;t found.</small>
        <label className={labelRow}>
          Extra light IPs, comma-separated
          <input className={input} value={f.ips} placeholder="192.168.1.50, 192.168.1.51" onChange={field('ips')} />
        </label>
        <label className={labelRow}>
          Scan ranges, comma-separated (optional)
          <input className={input} value={f.scan} placeholder="10.69.1.0/24" onChange={field('scan')} />
        </label>
        <small className="text-mut">
          Probes every address in these ranges directly, which works even when broadcasts are blocked. Leave blank to scan this server&rsquo;s own /24.
        </small>
        <small className="text-mut">
          {diag ? `This server is ${diag.local_ip ?? 'unknown'} \u00b7 replies from lights so far: ${diag.replies}` : ''}
        </small>
        <label className={labelRow}>
          Refresh every (seconds)
          <input type="number" min={1} step={1} className={input} value={f.poll} onChange={field('poll')} />
        </label>
      </Fieldset>

      <Fieldset legend="Location (for sunrise/sunset schedules)">
        <label className={labelRow}>
          Latitude
          <input type="number" step="any" className={input} placeholder="e.g. 40.71" value={f.lat} onChange={field('lat')} />
        </label>
        <label className={labelRow}>
          Longitude
          <input type="number" step="any" className={input} placeholder="e.g. -74.01" value={f.lon} onChange={field('lon')} />
        </label>
        <small className="text-mut">
          Schedules use this server&rsquo;s clock and timezone. Sun times are calculated locally; no internet needed.
        </small>
      </Fieldset>

      <Fieldset legend="Behavior">
        <label className={labelRow}>
          Fade time when changing (seconds)
          <input type="number" min={0} step={0.1} className={input} value={f.tr} onChange={field('tr')} />
        </label>
      </Fieldset>

      <small role="status" className="block min-h-4 text-mut">
        {msg}
      </small>
      {version && <small className="mb-2.5 block text-mut">Version {version}</small>}
      <div className="flex justify-end gap-2">
        <button className={btnSmall} onClick={closeSettings}>
          Close
        </button>
        <button className={btnPrimary} onClick={save}>
          Save settings
        </button>
      </div>
    </>
  );
}
