import { useState } from 'react';
import { useApp } from '../context';
import { hueSat } from '../color';
import { ACTION_LABELS, DAYS, isFx, isSecs, STROBE_WARN } from '../constants';
import type { Action, ActionType, Schedule } from '../types';
import { btn, btnPrimary, btnSmall, Fieldset, input, labelRow, Modal } from './ui';

export function ScheduleDialog() {
  const { draft, closeSchedule } = useApp();
  return (
    <Modal open={!!draft} onClose={closeSchedule} labelledBy="schedTitle">
      {draft && <ScheduleForm initial={draft.schedule} onClose={closeSchedule} />}
    </Modal>
  );
}

function ScheduleForm({ initial, onClose }: { initial: Schedule | null; onClose: () => void }) {
  const { groups, schedules, updateSchedules, runSchedule, stopSchedule, settings, ask } = useApp();
  const [base] = useState<Schedule>(
    () =>
      initial ?? {
        id: 's' + Date.now().toString(36),
        enabled: true,
        name: '',
        when: { type: 'time', time: '06:00', offset: 0 },
        days: [0, 1, 2, 3, 4, 5, 6],
        action: { type: 'off', target: 'all' },
      },
  );
  const [name, setName] = useState(base.name);
  const [wType, setWType] = useState(base.when.type);
  const [time, setTime] = useState(base.when.time ?? '06:00');
  const [offset, setOffset] = useState(String(base.when.offset ?? 0));
  const [days, setDays] = useState<number[]>(base.days);
  const [act, setAct] = useState<ActionType>(base.action.type);
  const [target, setTarget] = useState(base.action.target);
  const [preset, setPreset] = useState(base.action.preset ?? '');
  const [times, setTimes] = useState(String(base.action.times ?? 3));
  const [secs, setSecs] = useState(String(base.action.seconds ?? (base.action.type === 'flicker' ? 60 : 5)));
  const [color, setColor] = useState(base.action.color?.hex ?? '#ff0000');
  const [bri, setBri] = useState(String(base.action.color?.b ?? 100));
  const [msg, setMsg] = useState('');
  const [fade, setFade] = useState(String(base.action.fade ?? ''));
  const [steps, setSteps] = useState(() => structuredClone(base.steps ?? []));
  const running = schedules.find((s) => s.id === base.id)?.running;
  const editStep = (i: number, patch: Partial<NonNullable<Schedule['steps']>[number]>) => setSteps((ss) => ss.map((s, j) => j === i ? { ...s, ...patch } : s));

  const optionsFor = (a: string) => {
    const preOnly = a === 'preset';
    return [
      ...(preOnly ? [] : [{ id: 'all', label: 'All lights' }]),
      ...groups
        .filter((g) => !preOnly || (g.presets ?? []).length)
        .map((g) => ({ id: g.id, label: g.name + (g.hidden ? ' (hidden)' : '') })),
    ];
  };
  const options = optionsFor(act);
  const curTarget = options.some((o) => o.id === target) ? target : (options[0]?.id ?? 'all');
  const presets = groups.find((g) => g.id === curTarget)?.presets ?? [];
  const curPreset = presets.some((p) => p.id === preset) ? preset : (presets[0]?.id ?? '');
  const fx = isFx(act);

  const changeAction = (v: ActionType) => {
    setAct(v);
    setTarget(optionsFor(v)[0]?.id ?? 'all');
    if (v === 'flicker' && color === '#ff0000') setColor('#ff9329');
  };

  const buildAction = (): Action => {
    const timing = fade === '' ? {} : { fade: Math.min(7200, Math.max(0, Number(fade) || 0)) };
    if (act === 'preset') return { type: act, target: curTarget, preset: curPreset, ...timing };
    if (!fx) return { type: act, target: curTarget, ...timing };
    const [h, s] = hueSat(color);
    const cl = (v: string, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Number(v) || d));
    return {
      type: act,
      target: curTarget,
      ...(isSecs(act)
        ? { seconds: act === 'strobe' ? cl(secs, 1, 60, 5) : cl(secs, 1, 3600, 60) }
        : { times: cl(times, 1, 1000, 3) }),
      color: { hex: color, h, s, b: cl(bri, 1, 100, 100), k: 3500 },
    };
  };

  const save = (strobeOk = false): void => {
    if ((act === 'strobe' || steps.some((s) => s.action.type === 'strobe')) && !strobeOk) return ask(STROBE_WARN, 'Yes, save strobe schedule', () => save(true));
    if (act === 'preset' && !curPreset) return setMsg('Choose a group that has a saved preset.');
    if (steps.some((s) => s.action.type === 'preset' && !groups.find((g) => g.id === s.action.target)?.presets?.some((p) => p.id === s.action.preset))) return setMsg('Choose a valid preset for each routine step.');
    if (!days.length) return setMsg('Pick at least one day.');
    if (wType === 'time' && !time) return setMsg('Enter a time.');
    const next: Schedule = {
      ...base,
      name: name.trim() || 'Schedule',
      when: { type: wType, time, offset: Number(offset) || 0 },
      days,
      action: buildAction(),
      steps,
    };
    updateSchedules((ss) =>
      ss.some((x) => x.id === base.id) ? ss.map((x) => (x.id === base.id ? next : x)) : [...ss, next],
    );
    onClose();
  };

  const remove = () =>
    ask(
      `Delete the schedule \u201c${base.name || 'this schedule'}\u201d? This can\u2019t be undone.`,
      'Yes, delete',
      () => {
        updateSchedules((ss) => ss.filter((x) => x.id !== base.id));
        onClose();
      },
      true,
    );

  const run = async () => {
    const r = running ? await stopSchedule(base.id) : await runSchedule(base.id);
    setMsg(r.ok ? running ? 'Stopped.' : 'Started.' : r.error ?? 'Unable to change routine state.');
  };

  const toggleDay = (i: number, on: boolean) =>
    setDays((d) => (on ? [...d, i].sort((a, b) => a - b) : d.filter((x) => x !== i)));

  return (
    <>
      <h3 id="schedTitle" className="mb-3.5 text-[1.3rem] font-semibold">
        Schedule
      </h3>
      <Fieldset legend="Name">
        <input className={input} value={name} placeholder="e.g. Sunset indigo" onChange={(e) => setName(e.target.value)} />
      </Fieldset>

      <Fieldset legend="When">
        <select className={input} aria-label="When" value={wType} onChange={(e) => setWType(e.target.value as Schedule['when']['type'])}>
          <option value="time">At a specific time</option>
          <option value="sunrise">At sunrise</option>
          <option value="sunset">At sunset</option>
        </select>
        {wType === 'time' ? (
          <label className={labelRow}>
            Time
            <input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        ) : (
          <label className={labelRow}>
            Minutes after (negative = before)
            <input type="number" step={5} className={input} value={offset} onChange={(e) => setOffset(e.target.value)} />
          </label>
        )}
        {wType !== 'time' && settings.lat == null && (
          <small className="text-mut">Set your latitude/longitude in Settings first so sunrise and sunset can be calculated.</small>
        )}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 text-[.9rem]">
              <input type="checkbox" checked={days.includes(i)} onChange={(e) => toggleDay(i, e.target.checked)} />
              {d}
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Do this">
        <select className={input} aria-label="Action" value={act} onChange={(e) => changeAction(e.target.value as ActionType)}>
          {ACTION_LABELS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <label className={labelRow}>
          Lights
          <select className={input} value={curTarget} onChange={(e) => setTarget(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {act === 'preset' && (
          <label className={labelRow}>
            Preset
            <select className={input} value={curPreset} onChange={(e) => setPreset(e.target.value)}>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.hidden ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {!fx && <label className={labelRow}>Fade seconds (blank = default)
          <input type="number" min={0} max={7200} step={0.1} className={input} value={fade} onChange={(e) => setFade(e.target.value)} />
        </label>}
        {fx && !isSecs(act) && (
          <label className={labelRow}>
            Times
            <input type="number" min={1} max={1000} className={input} value={times} onChange={(e) => setTimes(e.target.value)} />
          </label>
        )}
        {isSecs(act) && (
          <label className={labelRow}>
            {act === 'flicker' ? 'Seconds (max 3600)' : 'Seconds (max 60)'}
            <input type="number" min={1} max={act === 'flicker' ? 3600 : 60} className={input} value={secs} onChange={(e) => setSecs(e.target.value)} />
          </label>
        )}
        {fx && (
          <>
            <label className={labelRow}>
              Color
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-[42px] w-full cursor-pointer rounded-lg border border-line bg-transparent p-0.5" />
            </label>
            <label className={labelRow}>
              Brightness (%)
              <input type="number" min={1} max={100} className={input} value={bri} onChange={(e) => setBri(e.target.value)} />
            </label>
            <small className="text-mut">
              Lights do this in the color above, then go back to what they were doing. Lights that are off are skipped.
            </small>
          </>
        )}
      </Fieldset>

      {steps.map((step, i) => <RoutineStep key={i} step={step} index={i} optionsFor={optionsFor}
        onChange={(patch) => editStep(i, patch)} onRemove={() => {
          const remove = () => setSteps((ss) => ss.filter((_, j) => j !== i));
          ask('Remove this routine step?', 'Yes, remove', remove, true);
        }} />)}
      <button type="button" className={btnSmall} onClick={() => setSteps((ss) => [...ss, { delay: 0, action: { type: 'off', target: 'all' } }])}>+ Add step</button>

      <small role="status" className="mb-2 block min-h-4 text-mut">
        {msg}
      </small>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {initial && (
            <>
              <button className={btn} onClick={remove}>
                Delete
              </button>
              <button className={btn} onClick={run}>
                {running ? 'Stop' : 'Run now'}
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className={btnSmall} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={() => save()}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

type Step = NonNullable<Schedule['steps']>[number];

function RoutineStep({ step, index, optionsFor, onChange, onRemove }: {
  step: Step;
  index: number;
  optionsFor: (type: string) => { id: string; label: string }[];
  onChange: (patch: Partial<Step>) => void;
  onRemove: () => void;
}) {
  const { groups } = useApp();
  const a = step.action;
  const fx = isFx(a.type);
  const patch = (p: Partial<Action>) => onChange({ action: { ...a, ...p } });
  const choices = optionsFor(a.type);
  const presets = groups.find((g) => g.id === a.target)?.presets ?? [];
  const number = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));
  return <Fieldset legend={'Step ' + (index + 2)}>
    <label className={labelRow}>Seconds after previous step completes
      <input type="number" className={input} min={0} max={86400} step={0.1} value={step.delay} onChange={(e) => onChange({ delay: number(e.target.value, 0, 86400) })} />
    </label>
    <label className={labelRow}>Action
      <select className={input} value={a.type} onChange={(e) => {
        const type = e.target.value as ActionType;
        const target = optionsFor(type)[0]?.id ?? 'all';
        const preset = groups.find((g) => g.id === target)?.presets?.[0]?.id;
        onChange({ action: { type, target, ...(type === 'preset' ? { preset } : {}), ...(isFx(type) ? { times: 3, seconds: type === 'flicker' ? 60 : 5, color: { hex: '#ff0000', h: 0, s: 100, b: 100, k: 3500 } } : {}) } });
      }}>
        {ACTION_LABELS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </label>
    <label className={labelRow}>Lights
      <select className={input} value={a.target} onChange={(e) => patch({ target: e.target.value, preset: groups.find((g) => g.id === e.target.value)?.presets?.[0]?.id })}>
        {choices.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
    {a.type === 'preset' && <label className={labelRow}>Preset
      <select className={input} value={a.preset ?? ''} onChange={(e) => patch({ preset: e.target.value })}>
        <option value="">Choose preset</option>
        {presets.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hidden ? ' (hidden)' : ''}</option>)}
      </select>
    </label>}
    {!fx && <label className={labelRow}>Fade seconds (blank = default)
      <input type="number" min={0} max={7200} step={0.1} className={input} value={a.fade ?? ''} onChange={(e) => patch({ fade: e.target.value === '' ? undefined : number(e.target.value, 0, 7200) })} />
    </label>}
    {fx && <>
      <label className={labelRow}>{isSecs(a.type) ? 'Seconds' : 'Times'}
        <input type="number" min={1} max={a.type === 'strobe' ? 60 : a.type === 'flicker' ? 3600 : 1000} className={input} value={isSecs(a.type) ? a.seconds ?? 5 : a.times ?? 3} onChange={(e) => patch(isSecs(a.type) ? { seconds: number(e.target.value, 1, a.type === 'strobe' ? 60 : 3600) } : { times: number(e.target.value, 1, 1000) })} />
      </label>
      <label className={labelRow}>Color
        <input type="color" value={a.color?.hex ?? '#ff0000'} onChange={(e) => { const [h, s] = hueSat(e.target.value); patch({ color: { hex: e.target.value, h, s, b: a.color?.b ?? 100, k: 3500 } }); }} />
      </label>
      <label className={labelRow}>Brightness (%)
        <input type="number" min={1} max={100} className={input} value={a.color?.b ?? 100} onChange={(e) => patch({ color: { ...(a.color ?? { hex: '#ff0000', h: 0, s: 100, k: 3500 }), b: number(e.target.value, 1, 100) } })} />
      </label>
    </>}
    <button type="button" className={btnSmall} onClick={onRemove}>Remove step</button>
  </Fieldset>;
}
