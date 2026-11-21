import { useState } from 'react';
import { useApp } from '../context';
import { groupColor } from '../color';
import { plural } from '../constants';
import { GroupCard } from '../components/GroupCard';
import { MiniCard } from '../components/MiniCard';
import { PageTitle, Sortable, btnSmall, grid } from '../components/ui';

export function GroupsPage() {
  const { lights, groups, saveOrder } = useApp();
  const [editing, setEditing] = useState(false);

  const visibleGroups = groups.filter((g) => !g.hidden);

  return (
    <>
      <PageTitle title="Groups" subtitle="Control several lights together.">
        {visibleGroups.length > 0 && (
          <button className={btnSmall} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Reorder'}
          </button>
        )}
      </PageTitle>

      <section aria-labelledby="groups-head" className="mt-8">
        <h2 id="groups-head" className="sr-only">
          Groups
        </h2>
        {visibleGroups.length === 0 ? (
          <p className="text-mut">
            {groups.length ? 'All groups are hidden. Change this in Settings.' : 'No groups yet. Create one in Settings.'}
          </p>
        ) : editing ? (
          <Sortable ids={visibleGroups.map((g) => g.id)} onCommit={(ids) => saveOrder('groups', ids)} className={grid}>
            {(id, grip, dragging) => {
              const g = visibleGroups.find((x) => x.id === id);
              if (!g) return null;
              const members = lights.filter((l) => g.members.includes(l.mac));
              return (
                <MiniCard
                  name={g.name}
                  sub={plural(members.length)}
                  color={groupColor(g.members, lights) ?? 'var(--line)'}
                  grip={grip}
                  dragging={dragging}
                />
              );
            }}
          </Sortable>
        ) : (
          <div className={grid}>
            {visibleGroups.map((g) => (
              <GroupCard key={g.id} g={g} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
