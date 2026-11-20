import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../context';
import { groupColor, lightHex, lightStatus } from '../color';
import { plural } from '../constants';
import { GroupCard } from '../components/GroupCard';
import { LightCard } from '../components/LightCard';
import { MiniCard } from '../components/MiniCard';
import { ScheduleCard } from '../components/ScheduleCard';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { SettingsDialog } from '../components/SettingsDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert, PageTitle, Sortable, btnPrimary, btnSmall, grid, lnk } from '../components/ui';
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
  const { lights, groups, schedules, connError, noLights, powerAll, openSettings, openSchedule, saveOrder } = useApp();
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

  const alertKey = connError ? 'conn' : noLights ? 'empty' : '';
  const showAlert = !!alertKey && dismissed !== alertKey;
  useEffect(() => {
    if (!alertKey) setDismissed('');
  }, [alertKey]);

  const visibleGroups = groups.filter((g) => !g.hidden);

  return (
    <>
      <PageTitle title="Lights" subtitle={countText}>
        <button className={btnPrimary} onClick={() => powerAll(true)}>
          All on
        </button>
        <button className={btnSmall} onClick={() => powerAll(false)}>
          All off
        </button>
        <button className={btnSmall} onClick={openSettings}>
          Settings
        </button>
      </PageTitle>

      {showAlert && (
        <div className="mb-5">
          <Alert
            tone={connError ? 'danger' : 'info'}
            title={connError ? 'Not connected to the lights server' : 'No lights found yet'}
            onDismiss={() => setDismissed(alertKey)}
          >
            {connError ??
              'Check Settings \u203a Network: the broadcast address, a scan range, or add a light\u2019s IP. Make sure this server is on the same network as the lights.'}
          </Alert>
        </div>
      )}

      <SectionHead
        k="schedules"
        title="Schedules"
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

      <SectionHead
        k="groups"
        title="Groups"
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
        k="lights"
        title="Lights"
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

      <SettingsDialog />
      <ScheduleDialog />
      <ConfirmDialog />
    </>
  );
}

function SectionHead({
  k,
  title,
  open,
  edit,
  onToggle,
  onEdit,
  extra,
  children,
}: {
  k: SectionKey;
  title: string;
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
        {open && (
          <button className={btnSmall} onClick={onEdit}>
            {edit ? 'Done' : 'Edit'}
          </button>
        )}
        {extra}
      </h2>
      {open && children}
    </section>
  );
}
