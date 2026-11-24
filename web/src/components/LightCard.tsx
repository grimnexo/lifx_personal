import { useState } from 'react';
import { useApp } from '../context';
import { useDisplay } from '../display';
import { hueSat, lightHex, lightStatus } from '../color';
import { FX, STROBE_WARN } from '../constants';
import type { FxKind, Light } from '../types';
import { card, kelvin, labelRow, lnk, seg, stLine, Switch, titleBtn } from './ui';

export function LightCard({ light: l }: { light: Light }) {
  const { isOpen, toggleOpen, setLight, startEffect, stopEffect, ask } = useApp();
  const { showIps } = useDisplay();
  const [funOpen, setFunOpen] = useState(false);
  const open = isOpen('l:' + l.mac);
  const col = l.s > 0;
  const c = l.on ? lightHex(l) : 'var(--line)';

  const setFx = (k: FxKind, on: boolean) => {
    if (!on) return stopEffect(l.mac, [l.mac]);
    const go = () => startEffect(l.mac, [l.mac], k);
    if (k === 'strobe') ask(`${STROBE_WARN} It stops by itself after 30 seconds.`, 'Yes, start strobe', go);
    else go();
  };

  return (
    <article
      className={`${card} border-t-[5px] ${l.online ? '' : 'opacity-50'}`}
      style={{ borderTopColor: c, boxShadow: l.on ? `0 -8px 28px -14px ${c}` : undefined }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5">
        <h3 className="min-w-0 text-[1.05rem] font-semibold">
          <button className={titleBtn} aria-expanded={open} onClick={() => toggleOpen('l:' + l.mac)}>
            {open ? '▾' : '▸'} {l.label}
          </button>
        </h3>
        <Switch checked={l.on} onChange={(on) => setLight(l.mac, { on }, { power: on })} label={`Power for ${l.label}`} />
        <p className={stLine}>{lightStatus(l)}</p>
        {showIps && <p className="whitespace-nowrap text-right text-[.8rem] tabular-nums text-ipc">{l.ip}</p>}
      </div>

      {open && (
        <>
          <div className="flex overflow-hidden rounded-full border border-line">
            <button className={seg(col)} onClick={() => setLight(l.mac, { s: 100 }, { s: 100, h: l.h })}>
              Color
            </button>
            <button className={seg(!col)} onClick={() => setLight(l.mac, { s: 0 }, { s: 0, k: l.k })}>
              White
            </button>
          </div>

          {col ? (
            <input
              type="color"
              aria-label="Color"
              value={lightHex(l)}
              className="h-[42px] w-full cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
              onChange={(e) => {
                const [h, s] = hueSat(e.target.value);
                setLight(l.mac, { h, s: s || 1 }, { h, s: s || 1 });
              }}
            />
          ) : (
            <>
              <label className={labelRow}>
                Warmth<output>{l.k} K</output>
              </label>
              <input
                type="range"
                className={kelvin}
                min={1500}
                max={9000}
                step={50}
                value={l.k}
                aria-label="Kelvin"
                onChange={(e) => {
                  const k = +e.target.value;
                  setLight(l.mac, { k, s: 0 }, { k, s: 0 });
                }}
              />
            </>
          )}

          <label className={labelRow}>
            Brightness<output>{l.b}%</output>
          </label>
          <input
            type="range"
            className="w-full accent-acc"
            min={0}
            max={100}
            value={l.b}
            aria-label="Brightness"
            onChange={(e) => {
              const b = +e.target.value;
              setLight(l.mac, { b }, { b });
            }}
          />

          <div className="grid justify-items-start gap-1.5">
            <button className={lnk} aria-expanded={funOpen} onClick={() => setFunOpen(!funOpen)}>
              Fun {funOpen ? '▾' : '▸'}
            </button>
            {funOpen && (
              <span className="flex flex-wrap gap-x-3.5 gap-y-1.5">
                {FX.map(([k, n]) => (
                  <span key={k} className="flex items-center gap-1.5 text-[.8rem] text-mut">
                    <span>{n}</span>
                    <Switch small checked={l.fx === k} onChange={(on) => setFx(k, on)} label={`${n} for ${l.label}`} />
                  </span>
                ))}
              </span>
            )}
          </div>
        </>
      )}
    </article>
  );
}
