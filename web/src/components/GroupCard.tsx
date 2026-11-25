import { useState } from 'react';
import { useApp } from '../context';
import { groupColor, hueSat, lightHex } from '../color';
import { FX, STROBE_WARN, plural } from '../constants';
import type { FxKind, Group } from '../types';
import { btn, btnSmall, card, input, kelvin, labelRow, stLine, Switch, titleBtn } from './ui';
import { PresetPanel } from './PresetPanel';
import { FxOptionsFields, fxOptions, noFxSettings, strobeSeconds } from './FxOptionsFields';
import type { FxSettings } from './FxOptionsFields';

type Panel = 'presets' | 'set' | 'fun' | null;

export function GroupCard({ g }: { g: Group }) {
  const { lights, isOpen, toggleOpen, setGroupLights, powerGroup } = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [fade, setFade] = useState('');
  const fadeSeconds = fade.trim() === '' ? undefined : Math.min(7200, Math.max(0, Number(fade)));
  const ms = lights.filter((l) => g.members.includes(l.mac));
  const gc = groupColor(g.members, lights);
  const open = isOpen('g:' + g.id);
  const avg = ms.length ? Math.round(ms.reduce((s, l) => s + l.b, 0) / ms.length) : 0;
  const togglePanel = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p);
  const panelBtn = (p: Exclude<Panel, null>, name: string) => (
    <button className={btnSmall} aria-expanded={panel === p} onClick={() => togglePanel(p)}>
      {panel === p ? 'Hide' : name}
    </button>
  );

  return (
    <div
      className={`${card} border-t-[5px]`}
      style={{ borderTopColor: gc ?? 'var(--line)', boxShadow: gc ? `0 -8px 28px -14px ${gc}` : undefined }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[1.05rem] font-semibold">
            <button className={titleBtn} aria-expanded={open} onClick={() => toggleOpen('g:' + g.id)}>
              {open ? '▾' : '▸'} {g.name}
            </button>
          </h3>
          <p className={stLine}>{plural(ms.length)}</p>
        </div>
        <div className="flex gap-2">
          <button className={btn} onClick={() => powerGroup(g, true, fadeSeconds)}>
            On
          </button>
          <button className={btn} onClick={() => powerGroup(g, false, fadeSeconds)}>
            Off
          </button>
        </div>
      </div>

      {open && (
        <>
          <label className={labelRow}>
            Fade for on and off (seconds, blank uses Settings)
            <input
              type="number"
              min={0}
              max={7200}
              step={0.1}
              className={input}
              value={fade}
              onChange={(e) => setFade(e.target.value)}
            />
          </label>
          <label className={labelRow}>Brightness</label>
          <input
            type="range"
            className="w-full accent-acc"
            min={0}
            max={100}
            value={avg}
            aria-label={`Brightness for ${g.name}`}
            onChange={(e) => {
              const b = +e.target.value;
              setGroupLights(g, { b }, { b });
            }}
          />
          <div className="flex flex-wrap justify-between gap-2">
            {panelBtn('presets', 'Presets')}
            {panelBtn('set', 'Set All')}
            {panelBtn('fun', 'Fun')}
          </div>
          {panel === 'presets' && <PresetPanel g={g} />}
          {panel === 'set' && <SetAllPanel g={g} />}
          {panel === 'fun' && <FunPanel g={g} />}
        </>
      )}
    </div>
  );
}

// One color or white setting applied to every light in the group at once
function SetAllPanel({ g }: { g: Group }) {
  const { lights, setGroupLights } = useApp();
  const first = lights.find((l) => g.members.includes(l.mac) && l.online) ?? lights.find((l) => g.members.includes(l.mac));
  const [mode, setMode] = useState<'color' | 'white'>(first && first.s > 0 ? 'color' : 'white');
  const [hx, setHx] = useState(first && first.s > 0 ? lightHex(first) : '#ff0000');
  const [k, setK] = useState(first?.k ?? 3500);

  const setColorMode = () => {
    setMode('color');
    const [h, s] = hueSat(hx);
    setGroupLights(g, { h, s: s || 100 }, { h, s: s || 100 }, true);
  };
  const setWhiteMode = () => {
    setMode('white');
    setGroupLights(g, { s: 0, k }, { s: 0, k }, true);
  };

  return (
    <div className="grid gap-2.5 border-t border-line pt-3">
      <div className="flex overflow-hidden rounded-full border border-line">
        <button className={`flex-1 cursor-pointer border-0 px-1 py-1 ${mode === 'color' ? 'bg-acc text-bg' : 'bg-transparent text-ink'}`} onClick={setColorMode}>
          Color
        </button>
        <button className={`flex-1 cursor-pointer border-0 px-1 py-1 ${mode === 'white' ? 'bg-acc text-bg' : 'bg-transparent text-ink'}`} onClick={setWhiteMode}>
          White
        </button>
      </div>
      {mode === 'color' ? (
        <input
          type="color"
          aria-label={`Color for all lights in ${g.name}`}
          value={hx}
          className="h-[42px] w-full cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          onChange={(e) => {
            setHx(e.target.value);
            const [h, s] = hueSat(e.target.value);
            setGroupLights(g, { h, s: s || 1 }, { h, s: s || 1 });
          }}
        />
      ) : (
        <>
          <label className={labelRow}>
            Warmth<output>{k} K</output>
          </label>
          <input
            type="range"
            className={kelvin}
            min={1500}
            max={9000}
            step={50}
            value={k}
            aria-label={`Kelvin for all lights in ${g.name}`}
            onChange={(e) => {
              const kv = +e.target.value;
              setK(kv);
              setGroupLights(g, { k: kv, s: 0 }, { k: kv, s: 0 });
            }}
          />
        </>
      )}
    </div>
  );
}

function FunPanel({ g }: { g: Group }) {
  const { lights, startEffect, stopEffect, ask } = useApp();
  const active = lights.find((l) => g.members.includes(l.mac) && l.fx)?.fx ?? null;
  const [fxSettings, setFxSettings] = useState<FxSettings>(noFxSettings);

  const setFx = (k: FxKind, on: boolean) => {
    if (!on) return stopEffect(g.id, g.members);
    const go = () => startEffect(g.id, g.members, k, fxOptions(k, fxSettings));
    if (k === 'strobe') ask(`${STROBE_WARN} It stops by itself after ${strobeSeconds(fxSettings)} seconds.`, 'Yes, start strobe', go);
    else go();
  };

  return (
    <div className="grid gap-2.5 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        {FX.map(([k, n]) => (
          <div key={k} className="flex items-center justify-between py-1">
            <span>{n}</span>
            <Switch checked={active === k} onChange={(on) => setFx(k, on)} label={n} />
          </div>
        ))}
      </div>
      <small className="text-mut">
        Only lights that are on are affected, using each light&rsquo;s current color unless you choose one below. Switch it off to restore the lights.
      </small>
      <FxOptionsFields value={fxSettings} onChange={setFxSettings} />
    </div>
  );
}
