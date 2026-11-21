import { DAYS, isFx } from './constants';
import type { Group, Schedule, Settings } from './types';

export function whenText(s: Schedule): string {
  const w = s.when;
  const days = s.days.length === 7 ? 'every day' : s.days.map((i) => DAYS[i]).join(', ');
  const at =
    w.type === 'time'
      ? `At ${w.time}`
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

export function nextText(s: Schedule, settings: Settings): string {
  if (s.enabled === false) return 'Disabled';
  if (s.next) {
    return (
      'Next: ' +
      new Date(s.next).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  }
  return s.when.type !== 'time' && settings.lat == null ? 'Set your location in Settings' : 'No upcoming run';
}
