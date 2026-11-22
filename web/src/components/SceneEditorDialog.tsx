import { useState } from 'react';
import { useApp } from '../context';
import { hexToHsb, hsb2rgb, toHex } from '../color';
import type { Pattern, Scene, ScenePattern } from '../types';
import { LightPicker } from './LightPicker';
import { Modal, btn, btnDanger, btnPrimary, btnSmall, input } from './ui';

type Mode = 'color' | 'pattern' | 'off';

interface Assignment {
  id: string;
  mode: Mode;
  color: string;
  pattern: string;
  lights: Set<string>;
}

const MODES: [Mode, string][] = [
  ['color', 'Solid color'],
  ['pattern', 'Pattern'],
  ['off', 'Off'],
];

export function SceneEditorDialog({
  open,
  scene,
  onClose,
}: {
  open: boolean;
  scene: Scene | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="sceneEditorTitle">
      <SceneForm key={scene?.id ?? 'new'} scene={scene} onClose={onClose} />
    </Modal>
  );
}

function SceneForm({ scene, onClose }: { scene: Scene | null; onClose: () => void }) {
  const { scenes, lights, rooms, patterns, updateScenes, ask } = useApp();
  const [name, setName] = useState(scene?.name ?? '');
  const [assignments, setAssignments] = useState<Assignment[]>(() => fromScene(scene, patterns));

  const update = (id: string, patch: Partial<Assignment>) =>
    setAssignments((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const active = assignments.filter((a) => a.lights.size > 0);
  const canSave = name.trim() !== '' && active.length > 0 && active.every((a) => a.mode !== 'pattern' || a.pattern);

  function save() {
    if (!canSave) return;
    const sceneLights: Scene['lights'] = {};
    const scenePatterns: ScenePattern[] = [];
    for (const a of active) {
      if (a.mode === 'pattern') {
        scenePatterns.push({ pattern: a.pattern, lights: [...a.lights] });
        continue;
      }
      for (const mac of a.lights) {
        sceneLights[mac] =
          a.mode === 'off' ? { on: false, h: 0, s: 0, b: 0, k: 3500 } : { on: true, ...hexToHsb(a.color), k: 3500 };
      }
    }
    const item: Scene = { id: scene?.id ?? newId(), name: name.trim(), lights: sceneLights, patterns: scenePatterns };
    updateScenes(scene ? scenes.map((s) => (s.id === scene.id ? item : s)) : [...scenes, item]);
    onClose();
  }

  function remove() {
    if (!scene) return;
    const id = scene.id;
    ask(`Delete the scene "${scene.name}"?`, 'Delete', () => updateScenes(scenes.filter((x) => x.id !== id)));
    onClose();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2 id="sceneEditorTitle" className="m-0 text-xl font-semibold">
        {scene ? 'Edit scene' : 'New scene'}
      </h2>

      <label className="grid gap-1.5 text-[.9rem] font-medium">
        Scene name
        <input
          className={input}
          maxLength={40}
          placeholder="e.g. Set whole house red"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <p className="m-0 text-[.85rem] text-mut">
        Each part of the scene picks some lights (from any rooms) and gives them a solid color, a pattern, or turns them off.
        A light can only be in one part.
      </p>

      {assignments.map((a, i) => {
        const locked = new Set(assignments.filter((o) => o.id !== a.id).flatMap((o) => [...o.lights]));
        return (
          <section key={a.id} className="grid gap-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[.9rem] font-semibold">Part {i + 1}</span>
              <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label={`Part ${i + 1} action`}>
                {MODES.map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={a.mode === m}
                    className={`cursor-pointer border-0 px-3 py-1.5 text-[.85rem] ${a.mode === m ? 'bg-acc text-on-acc' : 'bg-transparent text-ink'}`}
                    onClick={() => update(a.id, { mode: m })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {a.mode === 'color' && (
                <input
                  type="color"
                  aria-label={`Color for part ${i + 1}`}
                  value={a.color}
                  onChange={(e) => update(a.id, { color: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                />
              )}
              {a.mode === 'pattern' &&
                (patterns.length ? (
                  <select
                    aria-label={`Pattern for part ${i + 1}`}
                    className={`${input} w-auto min-w-44`}
                    value={a.pattern}
                    onChange={(e) => update(a.id, { pattern: e.target.value })}
                  >
                    <option value="">Choose a pattern</option>
                    {patterns.map((p: Pattern) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[.85rem] text-mut">Create a pattern from the Scenes menu first.</span>
                ))}
              {assignments.length > 1 && (
                <button
                  type="button"
                  className={`${btnSmall} ml-auto`}
                  onClick={() => setAssignments((list) => list.filter((o) => o.id !== a.id))}
                >
                  Remove part
                </button>
              )}
            </div>
            <LightPicker
              lights={lights}
              rooms={rooms}
              selected={a.lights}
              locked={locked}
              onChange={(next) => update(a.id, { lights: next })}
            />
          </section>
        );
      })}

      <div>
        <button
          type="button"
          className={btnSmall}
          onClick={() => setAssignments((list) => [...list, blankAssignment()])}
        >
          Add another part
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {scene ? (
          <button type="button" className={btnDanger} onClick={remove}>
            Delete scene
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={!canSave}>
            Save scene
          </button>
        </div>
      </div>
    </form>
  );
}

function blankAssignment(): Assignment {
  return { id: newId(), mode: 'color', color: '#ffffff', pattern: '', lights: new Set() };
}

function fromScene(scene: Scene | null, patterns: Pattern[]): Assignment[] {
  if (!scene) return [blankAssignment()];
  const out: Assignment[] = [];
  const solid = new Map<string, Assignment>();
  for (const [mac, c] of Object.entries(scene.lights)) {
    const key = c.on ? toHex(hsb2rgb(c.h, c.s, c.b)) : 'off';
    let a = solid.get(key);
    if (!a) {
      a = { id: newId(), mode: c.on ? 'color' : 'off', color: c.on ? key : '#ffffff', pattern: '', lights: new Set() };
      solid.set(key, a);
    }
    a.lights.add(mac);
  }
  out.push(...solid.values());
  for (const r of scene.patterns) {
    out.push({
      id: newId(),
      mode: 'pattern',
      color: '#ffffff',
      pattern: patterns.some((p) => p.id === r.pattern) ? r.pattern : '',
      lights: new Set(r.lights),
    });
  }
  return out.length ? out : [blankAssignment()];
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
