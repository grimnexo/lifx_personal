import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { FavoritesBar } from '../components/FavoritesBar';
import { StatusAlerts } from '../components/StatusAlerts';
import { Badge, PageTitle, btnPrimary, btnSmall, card } from '../components/ui';

export function DashboardPage() {
  const { lights, groups, schedules, rooms, sun, settings, live, connError, powerAll } = useApp();

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
        <Badge tone={live ? 'ok' : 'warn'}>{live ? 'Live' : 'Reconnecting'}</Badge>
        <button className={btnPrimary} onClick={() => powerAll(true)}>
          Turn all on
        </button>
        <button className={btnSmall} onClick={() => powerAll(false)}>
          Turn all off
        </button>
      </PageTitle>

      <StatusAlerts />

      <FavoritesBar />

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
