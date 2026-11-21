import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { subscribeLights } from './events';
import type {
  ApiResult,
  AppState,
  Diag,
  Favorite,
  FxKind,
  Group,
  Light,
  Preset,
  Room,
  Scene,
  Schedule,
  SectionKey,
  Settings,
  Sun,
} from './types';

type Body = Record<string, unknown>;

export interface Confirm {
  text: string;
  yes: string;
  run: () => void;
  equal: boolean;
}

export interface ScheduleDraft {
  schedule: Schedule | null;
}

export interface AppCtx {
  lights: Light[];
  groups: Group[];
  schedules: Schedule[];
  rooms: Room[];
  scenes: Scene[];
  favorites: Favorite[];
  sun: Sun | null;
  settings: Settings;
  version?: string;
  diag?: Diag;
  loaded: boolean;
  live: boolean;
  connError: string | null;
  noLights: boolean;
  isOpen(id: string): boolean;
  toggleOpen(id: string): void;
  setLight(mac: string, local: Partial<Light>, body?: Body): void;
  setGroupLights(g: Group, local: Partial<Light>, body: Body, now?: boolean): void;
  powerGroup(g: Group, on: boolean): void;
  powerAll(on: boolean): void;
  startEffect(target: string, macs: string[], kind: FxKind): void;
  stopEffect(target: string, macs: string[]): void;
  applyPreset(g: Group, p: Preset): void;
  powerRoom(room: Room, on: boolean): void;
  recallScene(scene: Scene): void;
  captureScene(name: string): void;
  updateRooms(rooms: Room[]): void;
  updateScenes(scenes: Scene[]): void;
  updateFavorites(favorites: Favorite[]): void;
  updateGroups(fn: (gs: Group[]) => Group[]): void;
  updateSchedules(fn: (ss: Schedule[]) => Schedule[]): void;
  saveOrder(key: SectionKey, ids: string[]): void;
  saveSettings(patch: Body): Promise<ApiResult>;
  runSchedule(id: string): Promise<ApiResult>;
  refresh(): Promise<void>;
  ask(text: string, yes: string, run: () => void, equal?: boolean): void;
  confirm: Confirm | null;
  closeConfirm(): void;
  draft: ScheduleDraft | null;
  openSchedule(s?: Schedule): void;
  closeSchedule(): void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

const DEFAULT_SETTINGS: Settings = {
  broadcast: '255.255.255.255',
  ips: [],
  scan: [],
  poll: 3,
  transition: 0.5,
  light_order: [],
  offline_after: null,
  lat: null,
  lon: null,
};

const mobileQuery = matchMedia('(max-width:700px), (pointer:coarse)');

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppState>({
    lights: [],
    groups: [],
    schedules: [],
    rooms: [],
    scenes: [],
    favorites: [],
    sun: null,
    settings: DEFAULT_SETTINGS,
  });
  const dataRef = useRef(data);
  dataRef.current = data;
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [noLights, setNoLights] = useState(false);
  const [cardOpen, setCardOpen] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);

  const lastEdit = useRef(0);
  const lastSave = useRef(0);
  const fails = useRef(0);
  const emptySince = useRef(0);
  const queued = useRef(new Map<string, { body: Body; timer?: number }>());

  const markEdit = () => {
    lastEdit.current = Date.now();
  };
  const markSave = () => {
    lastSave.current = Date.now();
  };

  // Lights changed in the last 1.5 s or groups/schedules saved in the last 2.5 s keep the local copy,
  // so polling never snaps a control back to an older value mid-interaction.
  async function refresh() {
    const s = await api<AppState>('state', 'GET');
    if (!s.lights) {
      if (++fails.current >= 2) setConnError(s.error ?? 'Can\u2019t reach the server.');
      return;
    }
    fails.current = 0;
    setConnError(null);
    setLoaded(true);
    const now = Date.now();
    const keepEdits = now - lastEdit.current < 1500;
    const keepSaved = now - lastSave.current < 2500;
    if (s.lights.length) {
      emptySince.current = 0;
      setNoLights(false);
    } else {
      if (!emptySince.current) emptySince.current = now;
      setNoLights(now - emptySince.current > 20000);
    }
    setData((d) => ({
      lights: keepEdits ? d.lights : s.lights ?? [],
      groups: keepSaved ? d.groups : s.groups ?? [],
      schedules: keepSaved ? d.schedules : s.schedules ?? [],
      rooms: keepSaved ? d.rooms : s.rooms ?? [],
      scenes: keepSaved ? d.scenes : s.scenes ?? [],
      favorites: keepSaved ? d.favorites : s.favorites ?? [],
      sun: s.sun ?? null,
      settings: keepSaved && s.settings ? { ...s.settings, light_order: d.settings.light_order } : s.settings ?? d.settings,
      version: s.version,
      diag: s.diag,
    }));
  }

  useEffect(() => {
    void refresh();
    let tick = 0;
    // Light state arrives over the live stream; the full state poll then runs about every 14 s instead of every 2 s.
    const t = window.setInterval(() => {
      tick += 1;
      if (!liveRef.current || tick % 7 === 0) void refresh();
    }, 2000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(
    () =>
      subscribeLights(
        (lights) => {
          fails.current = 0;
          setConnError(null);
          if (Date.now() - lastEdit.current < 1500) return;
          setData((d) => ({ ...d, lights }));
        },
        (on) => {
          liveRef.current = on;
          setLive(on);
        },
      ),
    [],
  );

  // Sends for the same key within 90 ms are merged into one request
  function queue(key: string, path: string, body: Body, now = false) {
    const q = queued.current.get(key) ?? { body: {} };
    queued.current.set(key, q);
    Object.assign(q.body, body);
    if (now) {
      clearTimeout(q.timer);
      queued.current.delete(key);
      void api(path, 'POST', q.body);
      return;
    }
    if (q.timer === undefined) {
      q.timer = window.setTimeout(() => {
        queued.current.delete(key);
        void api(path, 'POST', q.body);
      }, 90);
    }
  }

  function updateLights(pick: (l: Light) => boolean, patch: Partial<Light>) {
    setData((d) => ({ ...d, lights: d.lights.map((l) => (pick(l) ? { ...l, ...patch } : l)) }));
  }

  function setFx(macs: string[], k: FxKind | null) {
    setData((d) => ({
      ...d,
      lights: d.lights.map((l) => (macs.includes(l.mac) ? { ...l, fx: k && l.on && l.online ? k : null } : l)),
    }));
  }

  function setLight(mac: string, local: Partial<Light>, body: Body = {}) {
    markEdit();
    updateLights((l) => l.mac === mac, local);
    if (Object.keys(body).length) queue('light:' + mac, 'light/' + mac, body);
  }

  function setGroupLights(g: Group, local: Partial<Light>, body: Body, now = false) {
    markEdit();
    updateLights((l) => g.members.includes(l.mac), local);
    queue('group:' + g.id, 'group/' + g.id, body, now);
  }

  function powerGroup(g: Group, on: boolean) {
    markEdit();
    updateLights((l) => g.members.includes(l.mac), { on });
    void api('group/' + g.id, 'POST', { power: on });
  }

  function powerAll(on: boolean) {
    markEdit();
    setData((d) => ({ ...d, lights: d.lights.map((l) => ({ ...l, on })) }));
    void api('all', 'POST', { power: on });
  }

  function startEffect(target: string, macs: string[], kind: FxKind) {
    void api('effect/' + target, 'POST', { effect: kind });
    setFx(macs, kind);
  }

  function stopEffect(target: string, macs: string[]) {
    void api('effect/' + target, 'POST', { effect: 'stop' });
    setFx(macs, null);
  }

  function applyPreset(g: Group, p: Preset) {
    const entries = Object.entries(p.lights).filter(([m]) => g.members.includes(m));
    markEdit();
    setData((d) => ({
      ...d,
      lights: d.lights.map((l) => {
        const c = p.lights[l.mac];
        return c && g.members.includes(l.mac) ? { ...l, on: c.on, h: c.h, s: c.s, b: c.b, k: c.k } : l;
      }),
    }));
    void Promise.all(
      entries.map(([m, c]) => api('light/' + m, 'POST', { h: c.h, s: c.s, b: c.b, k: c.k, power: c.on })),
    );
  }

  function updateGroups(fn: (gs: Group[]) => Group[]) {
    const groups = fn(dataRef.current.groups);
    dataRef.current = { ...dataRef.current, groups };
    markSave();
    setData((d) => ({ ...d, groups }));
    void api('groups', 'PUT', { groups });
  }

  function powerRoom(room: Room, on: boolean) {
    markEdit();
    updateLights((l) => room.lights.includes(l.mac), { on });
    void api('room/' + room.id, 'POST', { power: on });
  }

  function recallScene(scene: Scene) {
    markEdit();
    setData((d) => ({
      ...d,
      lights: d.lights.map((l) => {
        const c = scene.lights[l.mac];
        return c ? { ...l, on: c.on, h: c.h, s: c.s, b: c.b, k: c.k } : l;
      }),
    }));
    void api('scene/' + scene.id + '/apply', 'POST');
  }

  function captureScene(name: string) {
    const lights = Object.fromEntries(
      dataRef.current.lights
        .filter((l) => l.online)
        .map((l) => [l.mac, { on: l.on, h: l.h, s: l.s, b: l.b, k: l.k }]),
    );
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    updateScenes([...dataRef.current.scenes, { id, name, lights }]);
  }

  function updateRooms(rooms: Room[]) {
    dataRef.current = { ...dataRef.current, rooms };
    markSave();
    setData((d) => ({ ...d, rooms }));
    void api('rooms', 'PUT', { rooms });
  }

  function updateScenes(scenes: Scene[]) {
    dataRef.current = { ...dataRef.current, scenes };
    markSave();
    setData((d) => ({ ...d, scenes }));
    void api('scenes', 'PUT', { scenes });
  }

  function updateFavorites(favorites: Favorite[]) {
    dataRef.current = { ...dataRef.current, favorites };
    markSave();
    setData((d) => ({ ...d, favorites }));
    void api('favorites', 'PUT', { favorites });
  }

  function updateSchedules(fn: (ss: Schedule[]) => Schedule[]) {
    const schedules = fn(dataRef.current.schedules);
    dataRef.current = { ...dataRef.current, schedules };
    markSave();
    setData((d) => ({ ...d, schedules }));
    void api('schedules', 'PUT', { schedules: schedules.map((s) => ({ ...s, next: undefined })) });
    window.setTimeout(() => void refresh(), 2700);
  }

  function saveOrder(key: SectionKey, ids: string[]) {
    if (key === 'groups') {
      updateGroups((gs) => {
        const byId = new Map(gs.map((g) => [g.id, g]));
        return [...ids.flatMap((id) => byId.get(id) ?? []), ...gs.filter((g) => g.hidden)];
      });
    } else if (key === 'schedules') {
      updateSchedules((ss) => {
        const byId = new Map(ss.map((s) => [s.id, s]));
        return ids.flatMap((id) => byId.get(id) ?? []);
      });
    } else {
      markSave();
      setData((d) => ({ ...d, settings: { ...d.settings, light_order: ids } }));
      void api('settings', 'PUT', { light_order: ids });
    }
  }

  async function saveSettings(patch: Body): Promise<ApiResult> {
    return api('settings', 'PUT', patch);
  }

  async function runSchedule(id: string): Promise<ApiResult> {
    const r = await api('schedule/' + id + '/run');
    if (r.ok) {
      markSave();
      setData((d) => ({
        ...d,
        schedules: d.schedules.map((s) => (s.id === id ? { ...s, manual_runs: (s.manual_runs ?? 0) + 1 } : s)),
      }));
    }
    return r;
  }

  function isOpen(id: string) {
    return id in cardOpen ? cardOpen[id] : !mobileQuery.matches;
  }

  function toggleOpen(id: string) {
    setCardOpen((o) => ({ ...o, [id]: !isOpen(id) }));
  }

  const lights = useMemo(() => {
    const ord = data.settings.light_order;
    const idx = (m: string) => {
      const i = ord.indexOf(m);
      return i < 0 ? 1e9 : i;
    };
    return [...data.lights].sort((x, y) => idx(x.mac) - idx(y.mac) || x.label.localeCompare(y.label));
  }, [data.lights, data.settings.light_order]);

  const value: AppCtx = {
    lights,
    groups: data.groups,
    schedules: data.schedules,
    rooms: data.rooms,
    scenes: data.scenes,
    favorites: data.favorites,
    sun: data.sun,
    settings: data.settings,
    version: data.version,
    diag: data.diag,
    loaded,
    live,
    connError,
    noLights,
    isOpen,
    toggleOpen,
    setLight,
    setGroupLights,
    powerGroup,
    powerAll,
    startEffect,
    stopEffect,
    applyPreset,
    powerRoom,
    recallScene,
    captureScene,
    updateRooms,
    updateScenes,
    updateFavorites,
    updateGroups,
    updateSchedules,
    saveOrder,
    saveSettings,
    runSchedule,
    refresh,
    ask: (text, yes, run, equal = false) => setConfirm({ text, yes, run, equal }),
    confirm,
    closeConfirm: () => setConfirm(null),
    draft,
    openSchedule: (s) => setDraft({ schedule: s ?? null }),
    closeSchedule: () => setDraft(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
