import { useState, type ReactNode } from 'react';
import { useApp } from '../context';
import { groupColor, lightHex, lightStatus } from '../color';
import { plural } from '../constants';
import type { Favorite } from '../types';
import { Modal, btnPrimary, btnSmall, lnk } from './ui';

interface Tile {
  key: string;
  name: string;
  sub: string;
  color: string;
  on: boolean | null;
  toggle: () => void;
}

export function FavoritesBar() {
  const { favorites, lights, groups, rooms, scenes, setLight, powerGroup, powerRoom, recallScene } = useApp();
  const [editing, setEditing] = useState(false);

  const tiles: Tile[] = [];
  for (const f of favorites) {
    const t = tileFor(f);
    if (t) tiles.push(t);
  }

  function tileFor(f: Favorite): Tile | null {
    if (f.type === 'light') {
      const l = lights.find((x) => x.mac === f.id);
      if (!l) return null;
      const lit = l.on && l.online;
      return {
        key: 'light:' + l.mac,
        name: l.label,
        sub: lightStatus(l),
        color: lit ? lightHex(l) : 'var(--line)',
        on: lit,
        toggle: () => setLight(l.mac, { on: !l.on }, { power: !l.on }),
      };
    }
    if (f.type === 'group') {
      const g = groups.find((x) => x.id === f.id);
      if (!g) return null;
      const members = lights.filter((l) => g.members.includes(l.mac));
      const on = members.some((l) => l.on && l.online);
      return {
        key: 'group:' + g.id,
        name: g.name,
        sub: plural(members.length),
        color: groupColor(g.members, lights) ?? 'var(--line)',
        on,
        toggle: () => powerGroup(g, !on),
      };
    }
    if (f.type === 'room') {
      const r = rooms.find((x) => x.id === f.id);
      if (!r) return null;
      const members = lights.filter((l) => r.lights.includes(l.mac));
      const on = members.some((l) => l.on && l.online);
      return {
        key: 'room:' + r.id,
        name: r.name,
        sub: plural(members.length),
        color: groupColor(r.lights, lights) ?? 'var(--line)',
        on,
        toggle: () => powerRoom(r, !on),
      };
    }
    const s = scenes.find((x) => x.id === f.id);
    if (!s) return null;
    return {
      key: 'scene:' + s.id,
      name: s.name,
      sub: 'Scene',
      color: 'var(--acc)',
      on: null,
      toggle: () => recallScene(s),
    };
  }

  return (
    <section aria-labelledby="fav-head" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="fav-head" className="m-0 text-[1.05rem] font-semibold">
          Favorites
        </h2>
        {tiles.length > 0 && (
          <button type="button" className={`${lnk} ml-auto`} onClick={() => setEditing(true)}>
            Edit favorites
          </button>
        )}
      </div>

      {tiles.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-line bg-card p-4 shadow-card">
          <span className="text-mut">Pin lights, rooms, groups or scenes here for one-tap control.</span>
          <button type="button" className={btnSmall} onClick={() => setEditing(true)}>
            Choose favorites
          </button>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-0">
          {tiles.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                aria-pressed={t.on ?? undefined}
                onClick={t.toggle}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-line bg-card p-3 text-left text-ink shadow-card hover:border-acc"
              >
                <span
                  aria-hidden="true"
                  className="size-9 flex-none rounded-full border border-line"
                  style={{ background: t.color }}
                />
                <span className="grid min-w-0">
                  <span className="truncate font-semibold">{t.name}</span>
                  <span className="truncate text-[.8rem] text-mut">
                    {t.on === null ? t.sub : t.on ? `On \u00b7 ${t.sub}` : `Off \u00b7 ${t.sub}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FavoritesDialog open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

function FavoritesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { favorites, lights, groups, rooms, scenes, updateFavorites } = useApp();
  const isFav = (type: Favorite['type'], id: string) => favorites.some((f) => f.type === type && f.id === id);

  function toggle(type: Favorite['type'], id: string, on: boolean) {
    const rest = favorites.filter((f) => !(f.type === type && f.id === id));
    updateFavorites(on ? [...rest, { type, id }] : rest);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="favTitle">
      <h2 id="favTitle" className="m-0 mb-1 text-xl font-semibold">
        Favorites
      </h2>
      <p className="m-0 mb-4 text-[.9rem] text-mut">Choose what appears in the quick-control row at the top.</p>
      <div className="grid gap-4">
        <Choices title="Lights">
          {lights.map((l) => (
            <Choice key={l.mac} label={l.label} checked={isFav('light', l.mac)} onChange={(v) => toggle('light', l.mac, v)} />
          ))}
        </Choices>
        <Choices title="Rooms">
          {rooms.map((r) => (
            <Choice key={r.id} label={r.name} checked={isFav('room', r.id)} onChange={(v) => toggle('room', r.id, v)} />
          ))}
        </Choices>
        <Choices title="Groups">
          {groups.map((g) => (
            <Choice key={g.id} label={g.name} checked={isFav('group', g.id)} onChange={(v) => toggle('group', g.id, v)} />
          ))}
        </Choices>
        <Choices title="Scenes">
          {scenes.map((s) => (
            <Choice key={s.id} label={s.name} checked={isFav('scene', s.id)} onChange={(v) => toggle('scene', s.id, v)} />
          ))}
        </Choices>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className={btnPrimary} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function Choices({ title, children }: { title: string; children: ReactNode }) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <fieldset className="grid gap-2 rounded-xl border border-line p-3">
      <legend className="px-1.5 font-semibold">{title}</legend>
      {empty ? (
        <p className="m-0 text-[.85rem] text-mut">None yet.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">{children}</div>
      )}
    </fieldset>
  );
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[.9rem]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
