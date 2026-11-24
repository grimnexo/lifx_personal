import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { useDisplay } from '../display';
import { formatClock } from '../schedule-text';

export function ServerClock() {
  const { serverTime } = useApp();
  const { hour24 } = useDisplay();
  const [received, setReceived] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const stamp = Date.now();
    setReceived(stamp);
    setNow(stamp);
  }, [serverTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!serverTime) return null;
  const iso = new Date(serverTime.epoch * 1000 + (now - received) + serverTime.utc_offset * 1000).toISOString();
  return <span className="text-sm tabular-nums text-mut">Server time: {formatClock(iso.slice(11, 19), hour24, true)}</span>;
}
