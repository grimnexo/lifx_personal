export const SCHEMES = ['auto', 'light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

export const ACCENTS = ['blue', 'teal', 'green', 'violet', 'amber', 'orange', 'rose', 'slate'] as const;
export type Accent = (typeof ACCENTS)[number];

export const CONTRASTS = ['standard', 'high'] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const TEXT_SIZES = ['small', 'default', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const MOTIONS = ['system', 'reduce'] as const;
export type Motion = (typeof MOTIONS)[number];

export interface Appearance {
  theme: Scheme;
  accent: Accent;
  contrast: Contrast;
  textSize: TextSize;
  motion: Motion;
}

export const ACCENT_INFO: Record<Accent, { label: string; swatch: string }> = {
  blue: { label: 'Blue', swatch: '#2563eb' },
  teal: { label: 'Teal', swatch: '#0f766e' },
  green: { label: 'Green', swatch: '#15803d' },
  violet: { label: 'Violet', swatch: '#6d4bd6' },
  amber: { label: 'Amber', swatch: '#b7791f' },
  orange: { label: 'Orange', swatch: '#c2410c' },
  rose: { label: 'Rose', swatch: '#be3455' },
  slate: { label: 'Slate', swatch: '#475569' },
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'auto',
  accent: 'blue',
  contrast: 'standard',
  textSize: 'default',
  motion: 'system',
};

const STORAGE_KEY = 'appearance';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const systemReduce = matchMedia('(prefers-reduced-motion: reduce)');

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return (options as readonly string[]).includes(value as string) ? (value as T) : fallback;
}

export function normalizeAppearance(v: Partial<Record<keyof Appearance, unknown>>): Appearance {
  return {
    theme: pick(SCHEMES, v.theme, DEFAULT_APPEARANCE.theme),
    accent: pick(ACCENTS, v.accent, DEFAULT_APPEARANCE.accent),
    contrast: pick(CONTRASTS, v.contrast, DEFAULT_APPEARANCE.contrast),
    textSize: pick(TEXT_SIZES, v.textSize, DEFAULT_APPEARANCE.textSize),
    motion: pick(MOTIONS, v.motion, DEFAULT_APPEARANCE.motion),
  };
}

function readStored(): Appearance {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

let current = readStored();

export function applyTheme() {
  const root = document.documentElement.dataset;
  root.theme = current.theme === 'auto' ? (systemDark.matches ? 'dark' : 'light') : current.theme;
  root.accent = current.accent;
  root.contrast = current.contrast;
  root.text = current.textSize;
  const reduce = current.motion === 'reduce' || (current.motion === 'system' && systemReduce.matches);
  root.motion = reduce ? 'reduce' : 'full';
}

export function applyAppearance(a: Appearance) {
  current = a;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable: appearance still applies for this page view */
  }
  applyTheme();
}

systemDark.addEventListener('change', applyTheme);
systemReduce.addEventListener('change', applyTheme);
