import { useSyncExternalStore } from 'react';

export const APP_ICONS = ['bulb', 'sun', 'moon', 'spark', 'bolt', 'home'] as const;
export type AppIcon = (typeof APP_ICONS)[number];

export const APP_ICON_LABELS: Record<AppIcon, string> = {
  bulb: 'Bulb',
  sun: 'Sun',
  moon: 'Moon',
  spark: 'Spark',
  bolt: 'Bolt',
  home: 'Home',
};

export const DEFAULT_LABEL = 'Lights';
export const LABEL_MAX = 24;

export interface Branding {
  icon: AppIcon;
  label: string;
  sidebarCollapsed: boolean;
}

const STORAGE_KEY = 'branding';
const DEFAULT: Branding = { icon: 'bulb', label: DEFAULT_LABEL, sidebarCollapsed: false };

function normalize(v: Partial<Record<keyof Branding, unknown>>): Branding {
  return {
    icon: (APP_ICONS as readonly string[]).includes(v.icon as string) ? (v.icon as AppIcon) : DEFAULT.icon,
    label: typeof v.label === 'string' ? v.label.slice(0, LABEL_MAX) : DEFAULT.label,
    sidebarCollapsed: v.sidebarCollapsed === true,
  };
}

function readStored(): Branding {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return { ...DEFAULT };
  }
}

let current = readStored();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBranding(): Branding {
  return useSyncExternalStore(subscribe, () => current);
}

export function updateBranding(patch: Partial<Branding>) {
  current = normalize({ ...current, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: branding still applies for this page view */
  }
  listeners.forEach((l) => l());
}

export function brandLabel(b: Branding): string {
  return b.label.trim() || DEFAULT_LABEL;
}
