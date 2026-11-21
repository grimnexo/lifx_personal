import { useState } from 'react';
import { useApp } from '../context';
import { hexToHsb, hsb2rgb, toHex } from '../color';
import type { Pattern, PatternStep } from '../types';
import { LightPicker } from './LightPicker';
import { Modal, arrayMove, btn, btnPrimary, btnSmall, input } from './ui';

const MAX_STEPS = 32;

export function PatternsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="patternsTitle">
      <PatternsContent onClose={onClose} />
    </Modal>
  );
}

function PatternsContent({ onClose }: { onClose: () => void }) {
  const { patterns, lights, rooms, updatePatterns, startPattern, stopLights, ask } = useApp();
  const [editing, setEditing] = useState<Pattern | 'new' | null>(null);
  const [applyId, setApplyId] = useState(patterns[0]?.id ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  if (editing) {
    return (
      <PatternEditor
        pattern={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
        onClose={onClose}
      />
    );
  }

  const applying = patterns.find((p) => p.id === applyId) ?? patterns[0];

  return (
    <>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 id="patternsTitle" className="m-0 text-xl font-semibold">
          Patterns
        </h2>
        <CloseButton onClose={onClose} label="Close patterns" />
      </div>
      <p className="m-0 mb-4 text-[.9rem] text-mut">
        A pattern cycles lights through a list of colors. Save it once, then start it on any lights.
      </p>

      <div className="mb-5 grid gap-2">
        {patterns.length === 0 && <p className="m-0 text-mut">No patterns yet.</p>}
        {patterns.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="text-[.8rem] text-mut">{p.steps.length} steps</div>
            </div>
            <button type="button" className={btnSmall} onClick={() => setEditing(p)}>
              Edit
            </button>
            <button
              type="button"
              className={btnSmall}
              onClick={() =>
                ask(`Delete the pattern "${p.name}"? Scenes that use it will skip it.`, 'Delete pattern', () =>
                  updatePatterns(patterns.filter((x) => x.id !== p.id)),
                )
              }
            >
              Delete
            </button>
          </div>
        ))}
        <div>
          <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
            New pattern
          </button>
        </div>
      </div>

      {patterns.length > 0 && (
        <section className="grid gap-3 border-t border-line pt-4">
          <h3 className="m-0 text-[1rem] font-semibold">Apply a pattern</h3>
          <label className="grid gap-1.5 text-[.9rem] font-medium">
            Pattern
            <select className={input} value={applyId} onChange={(e) => setApplyId(e.target.value)}>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <LightPicker lights={lights} rooms={rooms} selected={picked} onChange={setPicked} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={!applying || picked.size === 0}
              onClick={() => applying && startPattern([...picked], applying)}
            >
              Start on selected
            </button>
            <button type="button" className={btn} disabled={picked.size === 0} onClick={() => stopLights([...picked])}>
              Stop on selected
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function PatternEditor({
  pattern,
  onDone,
  onClose,
}: {
  pattern: Pattern | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const { patterns, updatePatterns } = useApp();
  const [name, setName] = useState(pattern?.name ?? '');
  const [steps, setSteps] = useState<PatternStep[]>(
    pattern?.steps ?? [{ ...hexToHsb('#ff0000'), k: 3500, seconds: 2 }],
  );

  const setStep = (i: number, patch: Partial<PatternStep>) =>
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const setColor = (i: number, hex: string) => setStep(i, hexToHsb(hex));

  function addStep() {
    const last = steps[steps.length - 1];
    const hex = last ? toHex(hsb2rgb(last.h, last.s, last.b)) : '#ff0000';
    setSteps((s) => [...s, { ...hexToHsb(hex), k: last?.k ?? 3500, seconds: last?.seconds ?? 2 }]);
  }

  function save() {
    const n = name.trim();
    if (!n || steps.length === 0) return;
    const item: Pattern = { id: pattern?.id ?? newId(), name: n, steps };
    updatePatterns(pattern ? patterns.map((p) => (p.id === pattern.id ? item : p)) : [...patterns, item]);
    onDone();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="patternsTitle" className="m-0 text-xl font-semibold">
          {pattern ? 'Edit pattern' : 'New pattern'}
        </h2>
        <CloseButton onClose={onClose} label="Close patterns" />
      </div>

      <label className="grid gap-1.5 text-[.9rem] font-medium">
        Name
        <input
          className={input}
          maxLength={40}
          placeholder="e.g. Ocean waves"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="grid gap-2">
        <span className="text-[.9rem] font-medium">Steps</span>
        {steps.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
            <span className="w-6 text-center text-[.85rem] tabular-nums text-mut">{i + 1}</span>
            <input
              type="color"
              aria-label={`Color for step ${i + 1}`}
              value={toHex(hsb2rgb(s.h, s.s, s.b))}
              onChange={(e) => setColor(i, e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
            />
            <label className="flex items-center gap-1.5 text-[.85rem] text-mut">
              Hold
              <input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                aria-label={`Seconds for step ${i + 1}`}
                value={s.seconds}
                onChange={(e) => setStep(i, { seconds: Number(e.target.value) })}
                className={`${input} w-20`}
              />
              s
            </label>
            <div className="ml-auto flex gap-1">
              <button type="button" className={btnSmall} disabled={i === 0} onClick={() => setSteps((x) => arrayMove(x, i, i - 1))} aria-label={`Move step ${i + 1} up`}>
                Up
              </button>
              <button
                type="button"
                className={btnSmall}
                disabled={i === steps.length - 1}
                onClick={() => setSteps((x) => arrayMove(x, i, i + 1))}
                aria-label={`Move step ${i + 1} down`}
              >
                Down
              </button>
              <button
                type="button"
                className={btnSmall}
                disabled={steps.length === 1}
                onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" className={btnSmall} disabled={steps.length >= MAX_STEPS} onClick={addStep}>
            Add step
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className={btn} onClick={onDone}>
          Back
        </button>
        <button type="submit" className={btnPrimary} disabled={!name.trim() || steps.length === 0}>
          Save pattern
        </button>
      </div>
    </form>
  );
}

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title="Close"
      className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-2xl leading-none text-mut hover:bg-soft hover:text-ink"
      onClick={onClose}
    >
      &times;
    </button>
  );
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
