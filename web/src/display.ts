import { useEffect, useState } from 'react';

type Display = { showIps: boolean; hour24: boolean };
const key = 'lifx.display';
const event = 'lifx-display-change';

function read(): Display {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return { showIps: value.showIps === true, hour24: value.hour24 !== false };
  } catch {
    return { showIps: false, hour24: true };
  }
}

export function useDisplay() {
  const [display, setDisplay] = useState(read);
  useEffect(() => {
    const sync = () => setDisplay(read());
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = (patch: Partial<Display>) => {
    localStorage.setItem(key, JSON.stringify({ ...read(), ...patch }));
    window.dispatchEvent(new Event(event));
  };
  return { ...display, update };
}
