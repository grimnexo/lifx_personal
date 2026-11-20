import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { colorRgb, snapshotOf, toHex } from '../color';
import { NO_LIGHTS_TO_SAVE } from '../constants';
import type { Group, LightSnap, Preset } from '../types';
import { btnPrimary, btnSmall, input, labelRow, Sortable } from './ui';

const swatch = (c: LightSnap) => toHex(colorRgb(c));

export function PresetPanel({ g }: { g: Group }) {
  const { lights, updateGroups, applyPreset, ask } = useApp();
  const presets = g.presets ?? [];
  const [detail, setDetail] = useState<string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const edit = (fn: (ps: Preset[]) => Preset[]) =>
    updateGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, presets: fn(x.presets ?? []) } : x)));

  const flash = (id: string) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1500);
  };

  const add = () => {
    const snap = snapshotOf(g.members, lights);
    if (!Object.keys(snap).length) return alert(NO_LIGHTS_TO_SAVE);
    const id = 'p' + Date.now().toString(36);
    edit((ps) => [...ps, { id, name: 'Preset ' + (ps.length + 1), lights: snap }]);
    setDetail((d) => [...d, id]);
  };

  const overwrite = (p: Preset) => {
    const snap = snapshotOf(g.members, lights);
    if (!Object.keys(snap).length) return alert(NO_LIGHTS_TO_SAVE);
    edit((ps) => ps.map((x) => (x.id === p.id ? { ...x, lights: snap } : x)));
    setDetail((d) => d.filter((i) => i !== p.id));
    flash(p.id);
  };

  const rename = (id: string, name: string) => edit((ps) => ps.map((x) => (x.id === id ? { ...x, name } : x)));

  const duplicate = (p: Preset) => {
    const i = presets.indexOf(p);
    const copy: Preset = { id: 'p' + Date.now().toString(36), name: p.name + '_COPY', lights: structuredClone(p.lights) };
    edit((ps) => [...ps.slice(0, i + 1), copy, ...ps.slice(i + 1)]);
  };

  const remove = (p: Preset) =>
    ask(`Delete the preset \u201c${p.name}\u201d? This can\u2019t be undone.`, 'Yes, delete', () =>
      edit((ps) => ps.filter((x) => x.id !== p.id)),
    );

  const toggleDetail = (id: string) =>
    setDetail((d) => (d.includes(id) ? d.filter((i) => i !== id) : [...d, id]));

  return (
    <div className="grid gap-3 border-t border-line pt-3">
      {presets.length === 0 && <p className="text-mut">No presets yet. Set the lights how you like, then add one.</p>}
      <Sortable
        ids={presets.map((p) => p.id)}
        onCommit={(ids) => edit((ps) => ids.flatMap((id) => ps.find((p) => p.id === id) ?? []))}
        className="grid"
      >
        {(id, grip, dragging) => {
          const p = presets.find((x) => x.id === id);
          if (!p) return null;
          const open = detail.includes(p.id);
          return (
            <div className={`grid gap-2 border-b border-line py-2 ${dragging ? 'rounded-xl bg-bg ring-2 ring-acc' : ''}`}>
              <div className="flex items-center gap-2">
                {grip(
                  'flex w-3.5 flex-none cursor-grab items-center justify-center self-stretch rounded before:h-[18px] before:w-[2px] before:border-x-2 before:border-solid before:border-mut before:content-[\'\'] hover:before:border-acc',
                  p.name,
                )}
                <button
                  className={`${btnPrimary} flex min-w-0 flex-1 justify-between gap-2 px-4 py-2 text-left font-semibold`}
                  title="Apply preset"
                  onClick={() => applyPreset(g, p)}
                >
                  <span className="truncate">{p.name}</span>
                  <span aria-hidden="true">{flashId === p.id ? 'Saved \u2713' : '\u25b8'}</span>
                </button>
                <div className="relative flex-none" data-menu>
                  <button
                    className={`${btnSmall} px-2.5`}
                    aria-haspopup="menu"
                    aria-expanded={menu === p.id}
                    aria-label={`Options for ${p.name}`}
                    onClick={() => setMenu(menu === p.id ? null : p.id)}
                  >
                    {'\u{1F354}'}
                  </button>
                  {menu === p.id && (
                    <div
                      role="menu"
                      className="absolute top-[calc(100%+6px)] right-0 z-10 min-w-[150px] overflow-hidden rounded-xl border border-line bg-card shadow-lg"
                    >
                      <MenuItem onClick={() => { setMenu(null); toggleDetail(p.id); }}>Edit Preset</MenuItem>
                      <MenuItem onClick={() => { setMenu(null); duplicate(p); }}>Duplicate Preset</MenuItem>
                      <MenuItem onClick={() => { setMenu(null); remove(p); }}>Delete Preset</MenuItem>
                    </div>
                  )}
                </div>
              </div>

              {open && (
                <div className="grid gap-2.5">
                  <div className="grid gap-1 text-[.82rem] text-mut">
                    {Object.values(p.lights).map((c, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <i className="size-3 flex-none rounded-full border border-line" style={{ background: swatch(c) }} />
                        {c.label}: {c.on ? `${c.s > 0 ? `Color ${swatch(c)}` : `White ${c.k} K`} \u00b7 ${c.b}%` : 'Off'}
                      </span>
                    ))}
                  </div>
                  <label className={labelRow}>
                    Rename
                    <input
                      key={p.name}
                      className={input}
                      defaultValue={p.name}
                      onBlur={(e) => rename(p.id, e.target.value.trim() || p.name)}
                    />
                  </label>
                  <div className="flex">
                    <button className={btnSmall} onClick={() => overwrite(p)}>
                      Save current settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </Sortable>
      <button className={`${btnSmall} justify-self-start`} aria-label="New preset from current settings" onClick={add}>
        + New preset
      </button>
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="block w-full cursor-pointer whitespace-nowrap border-0 px-4 py-2.5 text-left hover:bg-bg"
    >
      {children}
    </button>
  );
}
