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
  fx: FxKind | 'pattern' | null;
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
  hidden?: boolean;
}

export interface PatternStep {
  h: number;
  s: number;
  b: number;
  k: number;
  seconds: number;
}

export interface Pattern {
  id: string;
  name: string;
  steps: PatternStep[];
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
  fade?: number;
}

export interface Room {
  id: string;
  name: string;
  lights: string[];
}

export interface ScenePattern {
  pattern: string;
  lights: string[];
}

export interface Scene {
  id: string;
  name: string;
  lights: Record<string, Omit<LightSnap, 'label'>>;
  patterns: ScenePattern[];
}

export interface Favorite {
  type: 'light' | 'group' | 'room' | 'scene';
  id: string;
}

export interface Sun {
  sunrise: string | null;
  sunset: string | null;
}

export interface Schedule {
  id: string;
  name: string;
  enabled?: boolean;
  when: { type: 'time' | 'sunrise' | 'sunset'; time?: string; offset?: number };
  days: number[];
  action: Action;
  steps?: { delay: number; action: Action }[];
  running?: { step: number; of: number } | null;
  runs?: number;
  manual_runs?: number;
  next?: string | null;
}

export interface LightIp {
  ip: string;
  name: string;
}

export interface Settings {
  broadcast: string;
  ips: LightIp[];
  scan: string[];
  poll: number;
  transition: number;
  offline_after: number | null;
  light_order: string[];
  lat: number | null;
  lon: number | null;
  warm_presets: number[];
  favorite_colors: string[];
}

export interface Diag {
  local_ip: string | null;
  replies: number;
}

export interface AppState {
  lights: Light[];
  groups: Group[];
  schedules: Schedule[];
  rooms: Room[];
  scenes: Scene[];
  patterns: Pattern[];
  favorites: Favorite[];
  sun: Sun | null;
  server_time?: { epoch: number; utc_offset: number; hms: string };
  settings: Settings;
  version?: string;
  diag?: Diag;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
}
