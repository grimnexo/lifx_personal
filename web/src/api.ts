import type { ApiResult } from './types';

export async function api<T extends object = {}>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' = 'POST',
  body?: unknown,
): Promise<ApiResult & Partial<T>> {
  try {
    const r = await fetch('/api/' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: method === 'GET' ? AbortSignal.timeout(6000) : undefined,
    });
    if (r.status === 401 && !path.startsWith('auth/login')) window.dispatchEvent(new Event('lifx:signed-out'));
    try {
      return (await r.json()) as ApiResult & Partial<T>;
    } catch {
      return {
        ok: false,
        error: `The server replied with HTTP ${r.status}, not JSON. Is this page being served by hl_lifx_control.py?`,
      } as ApiResult & Partial<T>;
    }
  } catch (e) {
    return {
      ok: false,
      error:
        location.protocol === 'file:'
          ? 'This page was opened as a file. Open it from the server instead, e.g. http://localhost:8080'
          : `Can\u2019t reach ${location.host}. Make sure this device is on your home network and the lights service (hl_lifx_control.py) is running. (${(e as Error).message})`,
    } as ApiResult & Partial<T>;
  }
}
