import type { Light, LightSnap } from './types';

export type RGB = [number, number, number];

export function hsb2rgb(h: number, s: number, v: number): RGB {
  const sn = s / 100;
  const vn = v / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return vn - vn * sn * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255)) as RGB;
}

export function rgb2hs(r: number, g: number, b: number): [number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const m = Math.max(R, G, B);
  const d = m - Math.min(R, G, B);
  let h = 0;
  if (d) {
    h = m === R ? ((G - B) / d) % 6 : m === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [Math.round(h), m ? Math.round((d / m) * 100) : 0];
}

export function kRgb(k: number): RGB {
  const t = k / 100;
  const c = (x: number) => Math.round(Math.max(0, Math.min(255, x)));
  return [
    c(t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332),
    c(t <= 66 ? 99.47 * Math.log(t) - 161.2 : 288.1 * (t - 60) ** -0.0755),
    c(t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305),
  ];
}

export const toHex = (rgb: readonly number[]) =>
  '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');

export const fromHex = (hx: string): RGB =>
  [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)) as RGB;

export function hueSat(hx: string): [number, number] {
  const [r, g, b] = fromHex(hx);
  return rgb2hs(r, g, b);
}

export function hexToHsb(hx: string): { h: number; s: number; b: number } {
  const rgb = fromHex(hx);
  const [h, s] = rgb2hs(...rgb);
  return { h, s, b: Math.round((Math.max(...rgb) / 255) * 100) };
}

export function colorRgb(c: { h: number; s: number; k: number }): RGB {
  return c.s > 0 ? hsb2rgb(c.h, c.s, 100) : kRgb(c.k);
}

export const lightHex = (c: { h: number; s: number; k: number }) => toHex(colorRgb(c));

export function lightStatus(l: Light): string {
  if (!l.online) return 'Not responding';
  if (!l.on) return 'Off';
  const r = colorRgb(l);
  return (l.s > 0 ? `${toHex(r)} · rgb(${r.join(', ')})` : `${l.k} K white`) + ` · ${l.b}%`;
}

export function groupColor(members: string[], lights: Light[]): string | null {
  const on = lights.filter((l) => members.includes(l.mac) && l.on && l.online);
  if (!on.length) return null;
  return toHex([0, 1, 2].map((i) => Math.round(on.reduce((s, l) => s + colorRgb(l)[i], 0) / on.length)));
}

export function snapshotOf(members: string[], lights: Light[]): Record<string, LightSnap> {
  const out: Record<string, LightSnap> = {};
  lights
    .filter((l) => members.includes(l.mac))
    .forEach((l) => {
      out[l.mac] = { label: l.label, on: l.on, h: l.h, s: l.s, b: l.b, k: l.k };
    });
  return out;
}
