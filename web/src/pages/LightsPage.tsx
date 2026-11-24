import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { lightHex, lightStatus } from '../color';
import { LightCard } from '../components/LightCard';
import { MiniCard } from '../components/MiniCard';
import { ServerClock } from '../components/ServerClock';
import { StatusAlerts } from '../components/StatusAlerts';
import { Badge, Sortable, btnPrimary, btnDanger, btnSmall, card, grid } from '../components/ui';

export function LightsPage() {
  const { lights, live, connError, powerAll, saveOrder } = useApp();
  const [editing, setEditing] = useState(false);

  const onCount = lights.filter((l) => l.on && l.online).length;
  const onlineCount = lights.filter((l) => l.online).length;
  const percentOn = onlineCount ? Math.round((onCount / onlineCount) * 100) : 0;
  const statusText = lights.length
    ? `${onCount} of ${lights.length} on`
    : connError
      ? 'Not connected'
      : 'Looking for lights\u2026';

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">Lights</h1>
          <p className="m-0 mt-1 text-mut">{statusText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ServerClock />
          <Badge tone={live ? 'ok' : 'warn'}>{live ? 'Live' : 'Reconnecting'}</Badge>
          <Link to="/settings" className={btnSmall}>
            Settings
          </Link>
        </div>
      </header>

      <StatusAlerts />

      <section aria-labelledby="overview-head" className={`${card} mt-6 gap-4 p-5 sm:flex sm:items-center sm:justify-between`}>
        <div className="grid min-w-0 gap-2">
          <h2 id="overview-head" className="m-0 text-[.85rem] font-medium text-mut">
            Lights on
          </h2>
          <p className="m-0 flex items-baseline gap-2 font-bold leading-none tabular-nums">
            <span className="text-[2.4rem]">{onCount}</span>
            <span className="text-[1.05rem] font-medium text-mut">of {lights.length}</span>
          </p>
          <div
            role="progressbar"
            aria-label="Share of online lights that are on"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentOn}
            className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-soft"
          >
            <div className="h-full rounded-full bg-acc transition-[width]" style={{ width: `${percentOn}%` }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          <button className={btnPrimary} onClick={() => powerAll(true)}>
            Turn all on
          </button>
          <button className={btnDanger} onClick={() => powerAll(false)}>
            Turn all off
          </button>
          {lights.length > 0 && (
            <button className={btnSmall} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done' : 'Reorder'}
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="lights-head" className="mt-6">
        <h2 id="lights-head" className="sr-only">
          All lights
        </h2>
        {lights.length === 0 ? (
          <p className="text-mut">No lights found yet.</p>
        ) : editing ? (
          <Sortable ids={lights.map((l) => l.mac)} onCommit={(ids) => saveOrder('lights', ids)} className={grid}>
            {(id, grip, dragging) => {
              const l = lights.find((x) => x.mac === id);
              return l ? (
                <MiniCard
                  name={l.label}
                  sub={lightStatus(l)}
                  color={l.on && l.online ? lightHex(l) : 'var(--line)'}
                  grip={grip}
                  dragging={dragging}
                />
              ) : null;
            }}
          </Sortable>
        ) : (
          <div className={grid}>
            {lights.map((l) => (
              <LightCard key={l.mac} light={l} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
