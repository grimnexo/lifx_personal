import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../context';
import { lightHex } from '../color';
import { plural } from '../constants';
import { Alert, Badge, PageTitle, btnPrimary, btnSmall, input } from '../components/ui';
import type { Light } from '../types';

export function DevicesPage() {
  const { lights, connError } = useApp();
  return (
    <>
      <PageTitle title="Devices" subtitle={lights.length ? `${plural(lights.length)} found on this network` : 'No devices found yet'} />
      {connError && (
        <div className="mb-5">
          <Alert title="Not connected to the lights server">{connError}</Alert>
        </div>
      )}
      {lights.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-line bg-card shadow-card">
          <table className="w-full min-w-[680px] border-collapse text-left text-[.9rem]">
            <thead className="bg-soft text-mut">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Power</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Color</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Address</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">MAC</th>
              </tr>
            </thead>
            <tbody>
              {lights.map((l) => (
                <DeviceRow key={l.mac} light={l} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DeviceRow({ light: l }: { light: Light }) {
  const { refresh } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(l.label);
  const [error, setError] = useState('');

  const save = async () => {
    const next = name.trim();
    if (next && next !== l.label) {
      const r = await api('light/' + l.mac + '/label', 'PUT', { label: next });
      if (!r.ok) return setError(r.error ?? 'Could not rename this light.');
      await refresh();
    }
    setError('');
    setEditing(false);
  };

  const startEdit = () => {
    setName(l.label);
    setError('');
    setEditing(true);
  };

  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3">
        {editing ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input
              className={`${input} min-w-40 flex-1`}
              aria-label={`Name for ${l.label}`}
              value={name}
              maxLength={32}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={btnPrimary}>
              Save
            </button>
            <button type="button" className={btnSmall} onClick={() => setEditing(false)}>
              Cancel
            </button>
            {error && <small role="alert" className="w-full text-danger">{error}</small>}
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{l.label}</span>
            <button className={btnSmall} onClick={startEdit}>
              Rename
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tone={l.online ? 'ok' : 'off'}>{l.online ? 'Online' : 'Offline'}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge tone={l.on ? 'warn' : 'off'}>{l.on ? 'On' : 'Off'}</Badge>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 tabular-nums">
          <i className="size-4 rounded-full border border-line" style={{ background: lightHex(l) }} />
          {lightHex(l)}
        </span>
      </td>
      <td className="px-4 py-3 tabular-nums">{l.ip ?? '\u2014'}</td>
      <td className="px-4 py-3 font-mono text-[.8rem] text-mut">{l.mac}</td>
    </tr>
  );
}
