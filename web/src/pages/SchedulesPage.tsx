import { useState } from 'react';
import { useApp } from '../context';
import { ScheduleCard } from '../components/ScheduleCard';
import { MiniCard } from '../components/MiniCard';
import { PageTitle, Sortable, btnPrimary, btnSmall, grid } from '../components/ui';
import { whenText } from '../schedule-text';
import { useDisplay } from '../display';
import { ServerClock } from '../components/ServerClock';

export function SchedulesPage() {
  const { schedules, openSchedule, saveOrder } = useApp();
  const { hour24 } = useDisplay();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageTitle title="Schedules" subtitle="Schedule automatic actions and multi-step routines.">
        <ServerClock />
        <button className={btnPrimary} onClick={() => openSchedule()}>
          + New schedule
        </button>
        {schedules.length > 0 && (
          <button className={btnSmall} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Reorder'}
          </button>
        )}
      </PageTitle>

      <section aria-labelledby="schedules-head" className="mt-8">
        <h2 id="schedules-head" className="sr-only">
          Schedules
        </h2>
        {schedules.length === 0 ? (
          <p className="text-mut">No schedules yet.</p>
        ) : editing ? (
          <Sortable ids={schedules.map((s) => s.id)} onCommit={(ids) => saveOrder('schedules', ids)} className={grid}>
            {(id, grip, dragging) => {
              const s = schedules.find((x) => x.id === id);
              return s ? (
                <MiniCard name={s.name} sub={whenText(s, hour24)} color="var(--line)" grip={grip} dragging={dragging} />
              ) : null;
            }}
          </Sortable>
        ) : (
          <div className={grid}>
            {schedules.map((s) => (
              <ScheduleCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
