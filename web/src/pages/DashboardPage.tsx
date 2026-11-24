import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { FavoritesBar } from '../components/FavoritesBar';
import { ServerClock } from '../components/ServerClock';
import { StatusAlerts } from '../components/StatusAlerts';
import { Badge, PageTitle, btnPrimary, btnDanger, btnSmall, card } from '../components/ui';

export function DashboardPage() {
  const { lights, groups, schedules, rooms, sun, settings, live, connError, powerAll, stopSchedule } = useApp();
  const running = schedules.filter((s) => s.running);

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

  const visibleGroups = groups.filter((g) => !g.hidden);

  return (
    <>
      <PageTitle title="Dashboard" subtitle={subtitle}>
        <ServerClock />
        <Badge tone={live ? 'ok' : 'warn'}>{live ? 'Live' : 'Reconnecting'}</Badge>
        <div className="grid gap-2">
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => powerAll(true)}>Turn all on</button>
            <button className={btnDanger} onClick={() => powerAll(false)}>Turn all off</button>
          </div>
          <Link to="/settings" className={btnSmall}>Settings</Link>
        </div>
      </PageTitle>

      <StatusAlerts />

      <FavoritesBar />

      {running.length > 0 && (
        <section aria-labelledby="running-head" className="mt-8 grid gap-2">
          <h2 id="running-head" className="text-[1.05rem] font-semibold">Running now</h2>
          {running.map((s) => (
            <div key={s.id} className={`${card} grid-cols-[minmax(0,1fr)_auto] items-center`}>
              <span role="status">
                {s.name}
                {s.running && s.running.of > 1 ? ` \u00b7 step ${s.running.step} of ${s.running.of}` : ''}
              </span>
              <button className={btnSmall} onClick={() => void stopSchedule(s.id)}>Stop</button>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat to="/lights" label="Lights" value={lights.length} />
        <Stat to="/rooms" label="Rooms" value={rooms.length} />
        <Stat to="/groups" label="Groups" value={visibleGroups.length} />
        <Stat to="/schedules" label="Schedules" value={schedules.length} />
      </div>
    </>
  );
}

function Stat({ to, label, value }: { to: string; label: string; value: number }) {
  return (
    <Link to={to} className={`${card} no-underline transition-colors hover:border-acc`}>
      <span className="text-[.8rem] text-mut">{label}</span>
      <span className="text-[1.4rem] font-bold tabular-nums text-ink">{value}</span>
    </Link>
  );
}
