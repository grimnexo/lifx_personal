import { useState } from 'react';
import { useApp } from '../context';
import { RoomsDialog } from '../components/RoomsDialog';
import { Badge, PageTitle, btnPrimary, btnSmall, card, grid } from '../components/ui';

export function RoomsPage() {
  const { lights, rooms, powerRoom } = useApp();
  const [roomsOpen, setRoomsOpen] = useState(false);

  return (
    <>
      <PageTitle title="Rooms" subtitle="Turn a whole area on or off at once.">
        <button type="button" className={btnPrimary} onClick={() => setRoomsOpen(true)}>
          Manage rooms
        </button>
      </PageTitle>

      <section aria-labelledby="rooms-head" className="mt-8">
        <h2 id="rooms-head" className="sr-only">
          Rooms
        </h2>
        {rooms.length === 0 ? (
          <p className="text-mut">No rooms yet. Create rooms to turn a whole area on or off at once.</p>
        ) : (
          <div className={grid}>
            {rooms.map((r) => {
              const members = lights.filter((l) => r.lights.includes(l.mac));
              const litCount = members.filter((l) => l.on && l.online).length;
              return (
                <div key={r.id} className={card}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="m-0 min-w-0 truncate text-[1.05rem] font-semibold">{r.name}</h3>
                    <Badge tone={litCount ? 'ok' : 'off'}>{`${litCount} of ${members.length} on`}</Badge>
                  </div>
                  <p className="m-0 truncate text-[.85rem] text-mut">
                    {members.length ? members.map((l) => l.label).join(', ') : 'No lights assigned'}
                  </p>
                  <div>
                    <button
                      type="button"
                      className={btnSmall}
                      disabled={members.length === 0}
                      onClick={() => powerRoom(r, litCount === 0)}
                    >
                      {litCount === 0 ? 'Turn on' : 'Turn off'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <RoomsDialog open={roomsOpen} onClose={() => setRoomsOpen(false)} />
    </>
  );
}
