import { DAYS, isFx } from './constants';
import type { Group, Schedule, Settings } from './types';

export function formatClock(time: string, hour24: boolean, seconds = false): string {
  const [h = 0, m = 0, sec = 0] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (hour24 ? pad(h) : String(h % 12 || 12)) + ':' + pad(m) +
    (seconds ? ':' + pad(sec) : '') + (hour24 ? '' : h >= 12 ? ' PM' : ' AM');
}

export function whenText(s: Schedule, hour24 = true): string {
  const w = s.when;
  const days = s.days.length === 7 ? 'every day' : s.days.map((i) => DAYS[i]).join(', ');
  const at =
    w.type === 'time'
      ? `At ${formatClock(w.time ?? "06:00", hour24)}`
      : `At ${w.type}${w.offset ? ` ${w.offset > 0 ? '+' : ''}${w.offset} min` : ''}`;
  return `${at} \u00b7 ${days}`;
}

export function actionText(s: Schedule, groups: Group[]): string {
  const a = s.action;
  const g = groups.find((x) => x.id === a.target);
  const who = a.target === 'all' ? 'all lights' : g ? `group ${g.name}` : '(missing group)';
  if (a.type === 'preset') {
    const p = g?.presets?.find((x) => x.id === a.preset);
    return `Apply \u201c${p ? p.name : '(missing preset)'}\u201d to ${who}`;
  }
  if (isFx(a.type)) {
    const c = a.color;
    const secs = a.seconds ?? 0;
    const what =
      a.type === 'strobe'
        ? `Strobe ${secs} s`
        : a.type === 'flicker'
          ? `Candle flicker ${secs >= 120 && secs % 60 === 0 ? secs / 60 + ' min' : secs + ' s'}`
          : `${a.type === 'breathe' ? 'Breathe' : 'Pulse'} ${a.times}\u00d7`;
    return `${what} ${c?.hex ?? ''} ${c?.b ?? ''}% on ${who}`;
  }
  return `Turn ${a.type === 'on' ? 'on' : 'off'} ${who}`;
}

export function nextText(s: Schedule, settings: Settings, hour24 = true): string {
  if (s.enabled === false) return 'Disabled';
  if (s.next) {
    // Preserve the wall-clock time and date in the server's ISO timestamp.
    const date = new Date(s.next.slice(0, 10) + 'T00:00:00Z');
    const day = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    return 'Next: ' + day + ', ' + formatClock(s.next.slice(11, 16), hour24) + ' (server)';
  }
  return s.when.type !== 'time' && settings.lat == null ? 'Set your location in Settings' : 'No upcoming run';
}
