import { useApp } from '../context';
import { useDisplay } from '../display';
import { isFx } from '../constants';
import { actionText, nextText, whenText } from '../schedule-text';
import type { Schedule } from '../types';
import { btnDanger, btnSmall, card, stLine, Switch, titleBtn } from './ui';

export function ScheduleCard({ s }: { s: Schedule }) {
  const { groups, settings, isOpen, toggleOpen, updateSchedules, openSchedule, stopSchedule } = useApp();
  const { hour24 } = useDisplay();
  const open = isOpen('s:' + s.id);
  const off = s.enabled === false;
  const c = s.action.color;

  return (
    <article className={`${card} ${off ? 'opacity-50' : ''}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5">
        <h3 className="min-w-0 text-[1.05rem] font-semibold">
          <button className={titleBtn} aria-expanded={open} onClick={() => toggleOpen('s:' + s.id)}>
            {open ? '▾' : '▸'} {s.name}
          </button>
        </h3>
        <Switch
          checked={!off}
          onChange={(en) => updateSchedules((ss) => ss.map((x) => (x.id === s.id ? { ...x, enabled: en } : x)))}
          label={`Enable ${s.name}`}
        />
        <p className={stLine}>{whenText(s, hour24)}</p>
      </div>

      {s.running && (
        <div className="flex items-center justify-between gap-2">
          <span role="status">{s.running.of > 1 ? 'Running, step ' + s.running.step + ' of ' + s.running.of : 'Running'}</span>
          <button className={btnDanger} onClick={() => void stopSchedule(s.id)}>Stop</button>
        </div>
      )}
      {open && (
        <>
          <p className="m-0">
            {isFx(s.action.type) && c?.hex && actionText(s, groups).includes(c.hex) ? (
              <ColorInText text={actionText(s, groups)} hex={c.hex} />
            ) : (
              actionText(s, groups)
            )}
          </p>
          {!!s.steps?.length && <p className={stLine}>{s.steps.length + 1} routine steps</p>}
          {!s.running && <p className={`m-0 ${stLine}`}>{nextText(s, settings, hour24)}</p>}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="justify-self-start">
              <button className={btnSmall} onClick={() => openSchedule(s)}>
                Edit
              </button>
            </div>
            <div className="grid justify-self-center text-center text-[.72rem] whitespace-nowrap text-mut">
              <span>Manual Activations</span>
              <b className="text-[.95rem] tabular-nums text-ink">{s.manual_runs ?? 0}</b>
            </div>
            <div className="grid justify-self-end text-right text-[.72rem] whitespace-nowrap text-mut">
              <span>Times Activated</span>
              <b className="text-[.95rem] tabular-nums text-ink">{s.runs ?? 0}</b>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function ColorInText({ text, hex }: { text: string; hex: string }) {
  const i = text.indexOf(hex);
  return (
    <>
      {text.slice(0, i)}
      <span className="inline-flex items-center gap-1.5">
        <i className="size-3 rounded-full border border-line" style={{ background: hex }} />
        {hex}
      </span>
      {text.slice(i + hex.length)}
    </>
  );
}
