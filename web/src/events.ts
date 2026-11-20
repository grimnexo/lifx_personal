import type { Light } from './types';

// fetch rather than EventSource, so the session token can be sent as a header.
export function subscribeLights(onLights: (lights: Light[]) => void, onLive: (live: boolean) => void): () => void {
  let stopped = false;
  let ctrl: AbortController | null = null;

  async function run() {
    while (!stopped) {
      ctrl = new AbortController();
      try {
        const token = sessionStorage.getItem('lifx_session_token');
        const r = await fetch('/api/events', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ctrl.signal,
        });
        if (r.status === 401) {
          window.dispatchEvent(new Event('lifx:signed-out'));
          return;
        }
        if (!r.ok || !r.body) throw new Error(String(r.status));
        onLive(true);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buf.indexOf('\n\n')) >= 0) {
            const line = buf.slice(0, end).split('\n').find((l) => l.startsWith('data: '));
            buf = buf.slice(end + 2);
            if (line) onLights(JSON.parse(line.slice(6)));
          }
        }
      } catch {
        /* dropped or unreachable: reconnect below */
      }
      onLive(false);
      if (!stopped) await new Promise((res) => setTimeout(res, 3000));
    }
  }

  void run();
  return () => {
    stopped = true;
    ctrl?.abort();
  };
}
