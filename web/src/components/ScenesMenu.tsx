import { useEffect, useRef, useState } from 'react';
import { hexToHsb } from '../color';
import { useApp } from '../context';
import type { Scene } from '../types';
import { Icon } from './icons';
import { PatternsDialog } from './PatternsDialog';
import { SceneEditorDialog } from './SceneEditorDialog';
import { btn, btnPrimary, btnSmall, input } from './ui';

const row = 'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[.9rem] text-ink hover:bg-soft';

const sceneLightCount = (s: Scene) => new Set([...Object.keys(s.lights), ...s.patterns.flatMap((p) => p.lights)]).size;

interface MenuPlacement {
  align?: 'left' | 'right';
  drop?: 'up' | 'down';
  block?: boolean;
  compact?: boolean;
}

export function ScenesMenu({ align = 'right', drop = 'down', block = false, compact = false }: MenuPlacement) {
  const { scenes, lights, settings, recallScene, captureScene, applyToAll } = useApp();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [editor, setEditor] = useState<{ scene: Scene | null } | null>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onlineCount = lights.filter((l) => l.online).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function save() {
    const n = name.trim();
    if (!n) return;
    captureScene(n);
    setName('');
    setNaming(false);
  }

  return (
    <div className={block ? 'relative w-full' : 'relative'} ref={ref}>
      {compact ? (
        <button
          type="button"
          aria-label="Scenes"
          title="Scenes"
          aria-haspopup="menu"
          aria-expanded={open}
          className={`${btn} grid size-10 place-items-center p-0`}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="spark" className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className={`${btnSmall} ${block ? 'flex w-full justify-between' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          Scenes {'\u25be'}
        </button>
      )}
      {open && (
        <div
          role="menu"
          className={`absolute grid w-72 gap-1 rounded-[var(--radius)] border border-line bg-card p-2 shadow-card ${
            drop === 'up' ? 'bottom-full mb-2' : 'mt-2'
          } ${align === 'left' ? 'left-0' : 'right-0'}`}
        >
          {scenes.length === 0 && (
            <p className="m-0 px-3 py-2 text-[.85rem] text-mut">
              No scenes yet. Save the current colors and brightness as a scene to recall later.
            </p>
          )}
          {scenes.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                role="menuitem"
                className={`${row} flex-1`}
                onClick={() => {
                  recallScene(s);
                  setOpen(false);
                }}
              >
                <span className="truncate">{s.name}</span>
                <span className="flex-none text-[.8rem] text-mut">{sceneLightCount(s)} lights</span>
              </button>
              <button
                type="button"
                aria-label={`Edit scene ${s.name}`}
                className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-[.8rem] text-mut hover:bg-soft hover:text-ink"
                onClick={() => {
                  setEditor({ scene: s });
                  setOpen(false);
                }}
              >
                Edit
              </button>
            </div>
          ))}
          {(settings.warm_presets.length > 0 || settings.favorite_colors.length > 0) && (
            <>
              <div className="my-1 h-px bg-line" />
              <p className="m-0 px-3 pt-1 text-[.8rem] text-mut">Quick colors for all lights</p>
              <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1">
                {settings.warm_presets.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={btnSmall}
                    disabled={onlineCount === 0}
                    onClick={() => {
                      applyToAll({ power: true, s: 0, k }, { on: true, s: 0, k, fx: null });
                      setOpen(false);
                    }}
                  >
                    {k} K
                  </button>
                ))}
                {settings.favorite_colors.map((hex) => {
                  const { h, s, b } = hexToHsb(hex);
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Favorite color ${hex}`}
                      title={hex}
                      disabled={onlineCount === 0}
                      style={{ backgroundColor: hex }}
                      className="size-6 cursor-pointer rounded-full border border-line p-0 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        applyToAll({ power: true, h, s, b }, { on: true, h, s, b, fx: null });
                        setOpen(false);
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
          <div className="my-1 h-px bg-line" />
          {naming ? (
            <form
              className="flex gap-2 px-1 pb-1"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                className={input}
                autoFocus
                maxLength={40}
                placeholder="Scene name"
                aria-label="Scene name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className={btnPrimary} disabled={!name.trim()}>
                Save
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className={row}
                onClick={() => {
                  setEditor({ scene: null });
                  setOpen(false);
                }}
              >
                New scene{'\u2026'}
              </button>
              <button
                type="button"
                role="menuitem"
                className={row}
                disabled={onlineCount === 0}
                onClick={() => setNaming(true)}
              >
                Save current lights as scene{'\u2026'}
              </button>
              <button
                type="button"
                role="menuitem"
                className={row}
                onClick={() => {
                  setPatternsOpen(true);
                  setOpen(false);
                }}
              >
                Patterns{'\u2026'}
              </button>
            </>
          )}
        </div>
      )}
      <SceneEditorDialog
        open={editor !== null}
        scene={editor?.scene ?? null}
        onClose={() => setEditor(null)}
      />
      <PatternsDialog open={patternsOpen} onClose={() => setPatternsOpen(false)} />
    </div>
  );
}
