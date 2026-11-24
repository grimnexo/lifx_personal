import { hexToHsb } from '../color';
import type { FxKind, FxOptions } from '../types';
import { input, labelRow } from './ui';

export interface FxSettings {
  color: string;
  repeats: string;
  seconds: string;
}

export const noFxSettings: FxSettings = { color: '', repeats: '', seconds: '' };

export function fxOptions(kind: FxKind, v: FxSettings): FxOptions {
  const o: FxOptions = {};
  if (v.color) o.color = hexToHsb(v.color);
  if (kind === 'breathe' || kind === 'pulse') {
    const n = Math.floor(Number(v.repeats));
    if (n > 0) o.times = Math.min(n, 1000);
  } else {
    const n = Number(v.seconds);
    if (n > 0) o.seconds = Math.min(n, kind === 'strobe' ? 60 : 3600);
  }
  return o;
}

export function FxOptionsFields({ value, onChange }: { value: FxSettings; onChange: (v: FxSettings) => void }) {
  return (
    <div className="grid gap-2">
      <label className={labelRow}>
        Use a custom effect color
        <input
          type="checkbox"
          className="size-4 accent-acc"
          checked={value.color !== ''}
          onChange={(e) => onChange({ ...value, color: e.target.checked ? '#ff8800' : '' })}
        />
      </label>
      {value.color && (
        <input
          type="color"
          aria-label="Effect color"
          value={value.color}
          className="h-[38px] w-full cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          onChange={(e) => onChange({ ...value, color: e.target.value })}
        />
      )}
      <label className={labelRow}>
        Repeats for breathing or pulsing (blank runs up to an hour)
        <input
          type="number"
          min={1}
          max={1000}
          step={1}
          className={input}
          value={value.repeats}
          onChange={(e) => onChange({ ...value, repeats: e.target.value })}
        />
      </label>
      <label className={labelRow}>
        Seconds for strobe or candle (blank uses the default)
        <input
          type="number"
          min={1}
          max={3600}
          step={1}
          className={input}
          value={value.seconds}
          onChange={(e) => onChange({ ...value, seconds: e.target.value })}
        />
      </label>
    </div>
  );
}
