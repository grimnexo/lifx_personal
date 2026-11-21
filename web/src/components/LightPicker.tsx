import type { Light, Room } from '../types';
import { btnSmall } from './ui';

export function LightPicker({
  lights,
  rooms,
  selected,
  locked = new Set<string>(),
  onChange,
}: {
  lights: Light[];
  rooms: Room[];
  selected: Set<string>;
  locked?: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const inRoom = new Set(rooms.flatMap((r) => r.lights));
  const groups = [
    ...rooms.map((r) => ({ id: r.id, name: r.name, lights: lights.filter((l) => r.lights.includes(l.mac)) })),
    { id: '', name: 'No room', lights: lights.filter((l) => !inRoom.has(l.mac)) },
  ].filter((g) => g.lights.length > 0);

  function setMany(macs: string[], on: boolean) {
    const next = new Set(selected);
    for (const m of macs) {
      if (locked.has(m)) continue;
      if (on) next.add(m);
      else next.delete(m);
    }
    onChange(next);
  }

  if (!lights.length) return <p className="m-0 text-mut">No lights found yet.</p>;

  return (
    <div className="grid gap-3">
      {groups.map((g) => {
        const macs = g.lights.map((l) => l.mac);
        return (
          <fieldset key={g.id || 'none'} className="grid gap-1.5 rounded-xl border border-line p-3">
            <legend className="flex items-center gap-2 px-1.5 text-[.9rem] font-semibold">
              {g.name}
              <button type="button" className={btnSmall} onClick={() => setMany(macs, true)}>
                Select all
              </button>
              <button type="button" className={btnSmall} onClick={() => setMany(macs, false)}>
                Clear
              </button>
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {g.lights.map((l) => {
                const isLocked = locked.has(l.mac);
                return (
                  <label
                    key={l.mac}
                    className={`flex items-center gap-2 text-[.9rem] ${isLocked ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.mac)}
                      disabled={isLocked}
                      onChange={(e) => setMany([l.mac], e.target.checked)}
                    />
                    <span className="min-w-0 truncate">{l.label}</span>
                    {isLocked && <span className="ml-auto text-[.75rem] text-mut">used elsewhere</span>}
                    {!isLocked && !l.online && <span className="ml-auto text-[.75rem] text-mut">offline</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
