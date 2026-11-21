import { useSyncExternalStore } from 'react';

export const APP_ICONS = ['bulb', 'sun', 'moon', 'spark', 'bolt', 'home'] as const;
export type AppIcon = (typeof APP_ICONS)[number];
export type IconChoice = AppIcon | 'custom';

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
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ICON_PX = 128;
const MAX_ICON_CHARS = 200_000;

export interface Branding {
  icon: IconChoice;
  label: string;
  sidebarCollapsed: boolean;
  customIcon: string | null;
}

const STORAGE_KEY = 'branding';
const DEFAULT: Branding = { icon: 'bulb', label: DEFAULT_LABEL, sidebarCollapsed: false, customIcon: null };

function normalize(v: Partial<Record<keyof Branding, unknown>>): Branding {
  const customIcon =
    typeof v.customIcon === 'string' && v.customIcon.startsWith('data:image/') && v.customIcon.length <= MAX_ICON_CHARS
      ? v.customIcon
      : null;
  const icon =
    v.icon === 'custom' && customIcon
      ? 'custom'
      : (APP_ICONS as readonly string[]).includes(v.icon as string)
        ? (v.icon as AppIcon)
        : DEFAULT.icon;
  return {
    icon,
    label: typeof v.label === 'string' ? v.label.slice(0, LABEL_MAX) : DEFAULT.label,
    sidebarCollapsed: v.sidebarCollapsed === true,
    customIcon,
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

export function updateBranding(patch: Partial<Branding>): boolean {
  const next = normalize({ ...current, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  current = next;
  listeners.forEach((l) => l());
  return true;
}

export function brandLabel(b: Branding): string {
  return b.label.trim() || DEFAULT_LABEL;
}

export async function iconFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Choose an image under 5 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not prepare the image.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, ICON_PX, ICON_PX);
  bitmap.close();
  return canvas.toDataURL('image/png');
}
