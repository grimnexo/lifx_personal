import { useState } from 'react';
import { useApp } from '../context';
import { lightHex, lightStatus } from '../color';
import { LightCard } from '../components/LightCard';
import { MiniCard } from '../components/MiniCard';
import { StatusAlerts } from '../components/StatusAlerts';
import { Badge, PageTitle, Sortable, btnPrimary, btnSmall, grid } from '../components/ui';

export function LightsPage() {
  const { lights, live, connError, powerAll, saveOrder } = useApp();
  const [editing, setEditing] = useState(false);

  const onCount = lights.filter((l) => l.on && l.online).length;
  const subtitle = lights.length
    ? `${onCount} of ${lights.length} on`
    : connError
      ? 'Not connected'
      : 'Looking for lights\u2026';

  return (
    <>
      <PageTitle title="Lights" subtitle={subtitle}>
        <Badge tone={live ? 'ok' : 'warn'}>{live ? 'Live' : 'Reconnecting'}</Badge>
        <button className={btnPrimary} onClick={() => powerAll(true)}>
          Turn all on
        </button>
        <button className={btnSmall} onClick={() => powerAll(false)}>
          Turn all off
        </button>
        {lights.length > 0 && (
          <button className={btnSmall} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Reorder'}
          </button>
        )}
      </PageTitle>

      <StatusAlerts />

      <section aria-labelledby="lights-head" className="mt-8">
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
