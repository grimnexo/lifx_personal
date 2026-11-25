import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { FavoritesBar } from '../components/FavoritesBar';
import { Icon, type IconName } from '../components/icons';
import { ServerClock } from '../components/ServerClock';
import { StatusAlerts } from '../components/StatusAlerts';
import { Badge, btnDanger, btnPrimary, btnSmall, card } from '../components/ui';

export function DashboardPage() {
  const { lights, groups, schedules, rooms, sun, settings, live, connError, powerAll, stopSchedule } = useApp();
  const running = schedules.filter((s) => s.running);

  const onCount = lights.filter((l) => l.on && l.online).length;
  const onlineCount = lights.filter((l) => l.online).length;
  const percentOn = onlineCount ? Math.round((onCount / onlineCount) * 100) : 0;
  const statusText = onlineCount
    ? `${onCount} of ${onlineCount} online on`
    : lights.length
      ? 'All lights offline'
      : connError
      ? 'Not connected'
      : 'Looking for lights\u2026';
  const sunText =
    sun?.sunrise && sun?.sunset
      ? `Sunrise ${sun.sunrise} \u00b7 Sunset ${sun.sunset}`
      : settings.lat == null
        ? 'Set a location in Settings for sunrise and sunset'
        : '';

  const visibleGroups = groups.filter((g) => !g.hidden);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">Dashboard</h1>
          <p className="m-0 mt-1 text-mut">{[statusText, sunText].filter(Boolean).join(' \u00b7 ')}</p>
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
            <span className="text-[1.05rem] font-medium text-mut">of {onlineCount} online</span>
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
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat to="/lights" icon="lights" label="Lights" value={lights.length} />
        <Stat to="/rooms" icon="rooms" label="Rooms" value={rooms.length} />
        <Stat to="/groups" icon="groups" label="Groups" value={visibleGroups.length} />
        <Stat to="/schedules" icon="schedules" label="Schedules" value={schedules.length} />
      </div>

      {running.length > 0 && (
        <section aria-labelledby="running-head" className="mt-6 grid gap-2">
          <h2 id="running-head" className="m-0 text-[1.05rem] font-semibold">
            Running now
          </h2>
          {running.map((s) => (
            <div key={s.id} className={`${card} grid-cols-[minmax(0,1fr)_auto] items-center border-l-4 border-l-acc`}>
              <span role="status" className="min-w-0 truncate">
                {s.name}
                {s.running && s.running.of > 1 ? ` \u00b7 step ${s.running.step} of ${s.running.of}` : ''}
              </span>
              <button className={btnSmall} onClick={() => void stopSchedule(s.id)}>
                Stop
              </button>
            </div>
          ))}
        </section>
      )}

      <FavoritesBar />
    </>
  );
}

function Stat({ to, icon, label, value }: { to: string; icon: IconName; label: string; value: number }) {
  return (
    <Link to={to} className={`${card} no-underline transition-colors hover:border-acc`}>
      <span className="grid size-9 place-items-center rounded-lg bg-acc/10 text-acc">
        <Icon name={icon} className="size-5" />
      </span>
      <span className="text-[.8rem] text-mut">{label}</span>
      <span className="text-[1.5rem] font-bold tabular-nums text-ink">{value}</span>
    </Link>
  );
}
