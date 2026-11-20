import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../context';
import { groupColor, lightHex, lightStatus } from '../color';
import { plural } from '../constants';
import { GroupCard } from '../components/GroupCard';
import { LightCard } from '../components/LightCard';
import { MiniCard } from '../components/MiniCard';
import { ScheduleCard } from '../components/ScheduleCard';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FavoritesBar } from '../components/FavoritesBar';
import { RoomsDialog } from '../components/RoomsDialog';
import { Alert, Badge, PageTitle, Sortable, btnPrimary, btnSmall, card, grid, lnk } from '../components/ui';
import { whenText } from '../schedule-text';
import type { SectionKey } from '../types';

function readOpen(k: SectionKey): boolean {
  if (k === 'schedules') return false;
  try {
    return localStorage.getItem('open_' + k) !== '0';
  } catch {
    return true;
  }
}

export function DashboardPage() {
  const {
    lights,
    groups,
    schedules,
    rooms,
    sun,
    settings,
    live,
    connError,
    noLights,
    powerAll,
    powerRoom,
    openSchedule,
    saveOrder,
    refresh,
  } = useApp();
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() => ({
    groups: readOpen('groups'),
    lights: readOpen('lights'),
    schedules: readOpen('schedules'),
  }));
  const [edit, setEdit] = useState<Record<SectionKey, boolean>>({ groups: false, lights: false, schedules: false });
  const [dismissed, setDismissed] = useState('');

  const toggleSection = (k: SectionKey) => {
    const next = !open[k];
    setOpen((o) => ({ ...o, [k]: next }));
    if (!next) setEdit((e) => ({ ...e, [k]: false }));
    if (k !== 'schedules') {
      try {
        localStorage.setItem('open_' + k, next ? '1' : '0');
      } catch {
        /* storage unavailable: the section simply won't be remembered */
      }
    }
  };

  const onCount = lights.filter((l) => l.on && l.online).length;
  const countText = lights.length
    ? `${onCount} of ${lights.length} on`
    : connError
      ? 'Not connected'
      : 'Looking for lights\u2026';
  const sunText =
    sun?.sunrise && sun?.sunset
      ? `Sunrise ${sun.sunrise} \u00b7 Sunset ${sun.sunset}`
      : settings.lat == null
        ? 'Set a location in Settings for sunrise and sunset'
        : '';
  const subtitle = [countText, sunText].filter(Boolean).join(' \u00b7 ');
  const offline = lights.filter((l) => !l.online);

  const alertKey = connError ? 'conn' : noLights ? 'empty' : '';
  const showAlert = !!alertKey && dismissed !== alertKey;
  useEffect(() => {
    if (!alertKey) setDismissed('');
  }, [alertKey]);

  const visibleGroups = groups.filter((g) => !g.hidden);

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
      </PageTitle>

      {showAlert && (
        <div className="mt-5">
          <Alert
            tone={connError ? 'danger' : 'info'}
            title={connError ? 'Not connected to the lights server' : 'No lights found yet'}
            onDismiss={() => setDismissed(alertKey)}
          >
            {connError ? (
              <>
                {connError}{' '}
                <button type="button" className={`${lnk} underline`} onClick={() => void refresh()}>
                  Try again
                </button>
              </>
            ) : (
              'Check Settings \u203a Network: the broadcast address, a scan range, or add a light\u2019s IP. Make sure this server is on the same network as the lights.'
            )}
          </Alert>
        </div>
      )}

      {!connError && offline.length > 0 && (
        <div className="mt-5">
          <Alert tone="danger" title={`${plural(offline.length)} not responding`}>
            {offline.slice(0, 3).map((l) => l.label).join(', ')}
            {offline.length > 3 ? ` and ${offline.length - 3} more` : ''}. Check that they have power and are on this network.{' '}
            <button type="button" className={`${lnk} underline`} onClick={() => void refresh()}>
              Check again
            </button>
          </Alert>
        </div>
      )}

      <FavoritesBar />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lights" value={lights.length} />
        <Stat label="Rooms" value={rooms.length} />
        <Stat label="Groups" value={visibleGroups.length} />
        <Stat label="Schedules" value={schedules.length} />
      </div>

      <section aria-labelledby="rooms-head" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="rooms-head" className="m-0 text-[1.05rem] font-semibold">
            Rooms
          </h2>
          <button type="button" className={`${btnSmall} ml-auto`} onClick={() => setRoomsOpen(true)}>
            Manage rooms
          </button>
        </div>
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
        <RoomsDialog open={roomsOpen} onClose={() => setRoomsOpen(false)} />
      </section>

      <SectionHead
        k="lights"
        title="Lights"
        count={lights.length}
        open={open.lights}
        edit={edit.lights}
        onToggle={() => toggleSection('lights')}
        onEdit={() => setEdit((e) => ({ ...e, lights: !e.lights }))}
      >
        {lights.length === 0 ? (
          <p className="text-mut">No lights found yet.</p>
        ) : edit.lights ? (
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
      </SectionHead>

      <SectionHead
        k="groups"
        title="Groups"
        count={visibleGroups.length}
        open={open.groups}
        edit={edit.groups}
        onToggle={() => toggleSection('groups')}
        onEdit={() => setEdit((e) => ({ ...e, groups: !e.groups }))}
      >
        {visibleGroups.length === 0 ? (
          <p className="text-mut">
            {groups.length ? 'All groups are hidden. Change this in Settings.' : 'No groups yet. Create one in Settings.'}
          </p>
        ) : edit.groups ? (
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
      </SectionHead>

      <SectionHead
        k="schedules"
        title="Schedules"
        count={schedules.length}
        open={open.schedules}
        edit={edit.schedules}
        onToggle={() => toggleSection('schedules')}
        onEdit={() => setEdit((e) => ({ ...e, schedules: !e.schedules }))}
        extra={
          open.schedules && (
            <button className={`${btnSmall} ml-auto`} onClick={() => openSchedule()}>
              + New schedule
            </button>
          )
        }
      >
        {schedules.length === 0 ? (
          <p className="text-mut">No schedules yet.</p>
        ) : edit.schedules ? (
          <Sortable ids={schedules.map((s) => s.id)} onCommit={(ids) => saveOrder('schedules', ids)} className={grid}>
            {(id, grip, dragging) => {
              const s = schedules.find((x) => x.id === id);
              return s ? (
                <MiniCard name={s.name} sub={whenText(s)} color="var(--line)" grip={grip} dragging={dragging} />
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
      </SectionHead>

      <ScheduleDialog />
      <ConfirmDialog />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={card}>
      <span className="text-[.8rem] text-mut">{label}</span>
      <span className="text-[1.4rem] font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function SectionHead({
  k,
  title,
  count,
  open,
  edit,
  onToggle,
  onEdit,
  extra,
  children,
}: {
  k: SectionKey;
  title: string;
  count: number;
  open: boolean;
  edit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${k}-head`} className="mt-8">
      <h2 id={`${k}-head`} className="mb-3 flex flex-wrap items-center gap-2 text-[1.05rem] font-semibold">
        <button className={`${lnk} text-[1.05rem] font-bold text-ink`} aria-expanded={open} onClick={onToggle}>
          {open ? '\u25be ' : '\u25b8 '}
          {title}
        </button>
        <span className="text-[.85rem] font-normal tabular-nums text-mut">{count}</span>
        {open && (
          <button className={btnSmall} onClick={onEdit}>
            {edit ? 'Done' : 'Reorder'}
          </button>
        )}
        {extra}
      </h2>
      {open && children}
    </section>
  );
}
