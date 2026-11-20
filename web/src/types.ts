export type FxKind = 'breathe' | 'pulse' | 'strobe' | 'flicker';
export type ActionType = 'on' | 'off' | 'preset' | FxKind;
export type SectionKey = 'groups' | 'lights' | 'schedules';

export interface Light {
  mac: string;
  label: string;
  ip: string;
  online: boolean;
  on: boolean;
  h: number;
  s: number;
  b: number;
  k: number;
  fx: FxKind | null;
}

export interface LightSnap {
  label: string;
  on: boolean;
  h: number;
  s: number;
  b: number;
  k: number;
}

export interface Preset {
  id: string;
  name: string;
  lights: Record<string, LightSnap>;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  presets?: Preset[];
  hidden?: boolean;
}

export interface Color {
  hex: string;
  h: number;
  s: number;
  b: number;
  k: number;
}

export interface Action {
  type: ActionType;
  target: string;
  preset?: string;
  times?: number;
  seconds?: number;
  color?: Color;
}

export interface Schedule {
  id: string;
  name: string;
  enabled?: boolean;
  when: { type: 'time' | 'sunrise' | 'sunset'; time?: string; offset?: number };
  days: number[];
  action: Action;
  runs?: number;
  manual_runs?: number;
  next?: string | null;
}

export interface Settings {
  broadcast: string;
  ips: string[];
  scan: string[];
  poll: number;
  transition: number;
  light_order: string[];
  lat: number | null;
  lon: number | null;
}

export interface Diag {
  local_ip: string | null;
  replies: number;
}

export interface AppState {
  lights: Light[];
  groups: Group[];
  schedules: Schedule[];
  settings: Settings;
  version?: string;
  diag?: Diag;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
}
