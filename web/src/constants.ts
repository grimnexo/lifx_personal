import type { ActionType, FxKind } from './types';

export const FX: [FxKind, string][] = [
  ['breathe', 'Breathing'],
  ['pulse', 'Pulsing'],
  ['flicker', 'Candle'],
  ['strobe', 'Strobe'],
];

export const STROBE_WARN =
  'Strobing lights can trigger seizures in people with photosensitive epilepsy. Only continue if everyone nearby is safe around flashing lights.';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const NO_LIGHTS_TO_SAVE =
  'None of this group\u2019s lights were found, so there is nothing to save yet.';

export const isFx = (a: string): a is FxKind => ['breathe', 'pulse', 'flicker', 'strobe'].includes(a);
export const isSecs = (a: string) => a === 'strobe' || a === 'flicker';

export const ACTION_LABELS: [ActionType, string][] = [
  ['off', 'Turn off'],
  ['on', 'Turn on'],
  ['preset', 'Apply a preset'],
  ['breathe', 'Breathe'],
  ['pulse', 'Pulse (flash)'],
  ['flicker', 'Candle flicker'],
  ['strobe', 'Strobe'],
];

export const plural = (n: number, word = 'light') => `${n} ${word}${n === 1 ? '' : 's'}`;
