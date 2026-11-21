# Backend Requirements

This document describes what a production backend for the LIFX control app needs to provide. It reflects the current behavior of `hl_lifx_control.py` and the React frontend in `web/`, and lists the gaps to close before the app is treated as production-ready.

## 1. Scope and Constraints

- **Device control must run on the server.** Browsers cannot send LIFX LAN UDP packets, so a server on the same network as the bulbs must send the packets and expose HTTP/JSON to the frontend.
- **Discovery is LAN-only.** Discovery uses a broadcast address and optional scan ranges, and direct IP entries are supported for bulbs that do not answer broadcasts.
- **Single household by default.** The current model is one shared config with several local user accounts. Multi-tenant hosting is out of scope unless specified later.
- **Frontend is a static SPA** served from `web/dist`, with SPA fallback for client routes such as `/devices` and `/profile`.

## 2. Data Model

Stored in one JSON document today (`config.json`). A production backend should move this to a database, but the entities below are the baseline.

### Settings
| Field | Type | Notes |
|---|---|---|
| `broadcast` | string | IPv4 broadcast address, for example `10.40.14.255` |
| `ips` | string[] | Direct light IPs for devices that do not respond to broadcast |
| `scan` | string[] | Scan ranges or addresses |
| `poll` | number | Seconds between device polls, minimum 1 |
| `transition` | number | Default transition time in seconds, minimum 0 |
| `lat`, `lon` | number or null | Coordinates for sunrise/sunset, validated to ±90 and ±180 |
| `light_order` | string[] | MAC addresses in display order |

### Lights (device records, runtime)
- `mac`, `ip`, `label`, `power`, `hue`, `saturation`, `brightness`, `kelvin`, `online`, `last_seen`.
- Labels are capped at 32 bytes of UTF-8 and must be non-empty.

### Groups
- `id`, `name`, `members` (MAC list). Group membership must reference known lights.

### Rooms
- `id`, `name`, `lights` (MAC list).
- **Invariant:** a light belongs to at most one room. The current server enforces this on write and drops duplicates.

### Scenes
- `id`, `name`, `lights` map keyed by MAC, each entry holding `on`, `h`, `s`, `b`, `k`.
- Recall applies only to lights present in the scene. Missing or offline lights are reported, not silently skipped (see section 5).

### Favorites
- `type` in `light | group | room | scene`, `id` string.
- Favorites referencing deleted entities should be pruned, or flagged as stale.

### Schedules
- `id`, `name`, `enabled`, `days` (0–6, empty means every day), `action` (`target`, `type`, plus parameters), and a time trigger.
- Time trigger is either a fixed `HH:MM` or `sun_event` (`sunrise` | `sunset`) with `offset` minutes.
- Server-owned counters: `runs`, `manual_runs`. Clients must not overwrite these.
- `next` is computed on read, not stored.

### Users
- `id`, `username` (unique, case-insensitive), `name`, `theme` (currently `auto` by default).
- `password_hash`, optional `pin_hash`. Hashes use PBKDF2-HMAC-SHA256 with per-secret salt.
- Development account `test` / `test` is created only when no users exist. **It must be disabled in production builds.**

### Sessions
- Opaque random token, server-side record with user ID, created time, expiry, and last-seen.
- Logout invalidates the token server-side.

## 3. Authentication and Security

Required for production:

- **Session transport:** HttpOnly, Secure, SameSite cookie. The current bearer-token workaround (token returned in JSON and kept in `sessionStorage`) exposes the token to any script on the page and must not ship. Remove it once cookie delivery is reliable in the target environments.
- **CSRF protection** for state-changing requests when cookies are used.
- **Password policy:** minimum length, rate limiting and lockout on login and PIN attempts. PINs need their own stricter limit because they are short.
- **Account management:** change password (requires current password), change PIN, sign out other sessions.
- **Authorization:** all `/api/*` routes except auth require a valid session. Any write to shared config is restricted to authenticated users. Consider roles (admin vs. member) if multiple people share the system.
- **Input validation** on all write endpoints: type checks, size limits, and allowed-value lists.
- **TLS** termination at the reverse proxy or server.
- **Audit log** of sign-ins, failed attempts, and config changes.
- **Secrets:** no default secrets in code. Session/hash configuration comes from the environment.

## 4. API Surface

All paths are under `/api`. Responses are JSON with `ok` and, on error, `error`.

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Body: `username` and `password`, or `username` and `pin`. Sets session cookie. |
| POST | `/auth/logout` | Invalidates the current session. |
| GET | `/auth/me` | Returns the current user, or 401. |
| PUT | `/account` | Update name, theme, accent, password, or PIN. |

### State and live updates
| Method | Path | Purpose |
|---|---|---|
| GET | `/state` | Full snapshot: lights, groups, rooms, scenes, favorites, schedules (with `next`), settings, `sun` (today's sunrise/sunset), version, diagnostics. |
| GET | `/events` | Server-Sent Events stream of light snapshots, with keep-alive comments. Authenticated. |

### Lights and control
| Method | Path | Purpose |
|---|---|---|
| POST | `/light/{mac}` | Set power, color, brightness, kelvin, duration. |
| POST | `/light/{mac}/label` | Rename a light. |
| POST | `/all` | Apply a change to all lights. |
| POST | `/group/{id}` | Apply a change to a group. |
| POST | `/effect/{target}` | Start breathe, pulse, strobe, or flicker, or stop. Target is `all`, a group ID, or a MAC. |

### Rooms, scenes, favorites, groups
| Method | Path | Purpose |
|---|---|---|
| PUT | `/rooms` | Replace room list (server enforces single-room membership). |
| POST | `/room/{id}` | Power on or off all lights in a room. |
| PUT | `/scenes` | Replace scene list (validate per-light fields). |
| POST | `/scene/{id}/apply` | Recall a scene. Returns per-light results. |
| PUT | `/favorites` | Replace favorites list. |
| PUT | `/groups` | Replace group list. |

### Schedules
| Method | Path | Purpose |
|---|---|---|
| PUT | `/schedules` | Replace schedule list. Preserve server counters. |
| POST | `/schedule/{id}/run` | Run a schedule now and increment `manual_runs`. |

### Settings and discovery
| Method | Path | Purpose |
|---|---|---|
| PUT | `/settings` | Partial update of settings with validation. |
| POST | `/discover` | **Not implemented.** Proposed: trigger an immediate scan. Discovery currently runs continuously. |

Recommended change: replace the many `PUT` list endpoints with resource-level operations (`POST /rooms`, `PATCH /rooms/{id}`, `DELETE /rooms/{id}`). This avoids last-write-wins conflicts when two browsers edit at once.

## 5. Behavior Requirements

- **Discovery:** broadcast a LIFX get-service request on the configured broadcast address, and probe direct IPs and scan ranges. Track `last_seen`. A light is `online` if seen within roughly four poll intervals plus a margin.
- **Errors per device:** a send that fails for one bulb must not block others. Surface a per-device error state, with the first error logged and repeats suppressed.
- **Diagnostics:** report the local interface IP used for broadcasts, reply counts, and whether the network is blocking UDP. The frontend displays this when no lights are found.
- **Scene recall:** return a per-light result (`applied`, `offline`, `missing`) so the UI can report partial failures.
- **Room and group power:** apply concurrently, with a timeout per device.
- **Schedules:**
  - Evaluate in the server's timezone, and expose the timezone in `/state`. The UI currently notes that schedules use local server time.
  - Sunrise/sunset is computed from `lat`/`lon`. Missing coordinates must disable sun-based triggers and say so in the response.
  - Missed triggers (server down at fire time) should be defined: skip, or run once on restart.
- **Real-time:** SSE with a bounded update rate (for example at most 5 per second per client), heartbeats every 15–30 seconds, and `Last-Event-ID` support if reconnect gaps matter.
- **Persistence:** atomic writes (write temp file, then rename). Keep one backup of the previous version.
- **Concurrency:** all device state changes go through a single lock or queue. Long operations (effects, discovery) must not block HTTP responses.

## 6. Operations

- Configuration through environment variables: bind address, port, data directory, broadcast default, session secret, and whether the dev account is enabled.
- Structured logs with levels. Remove per-packet noise at the default level.
- Health endpoint (`GET /healthz`) for process managers and uptime checks.
- Version reported in `/state` and in logs.
- Graceful shutdown: stop schedules and effects, flush config.
- Backups of the data directory on a schedule.

## 7. Testing Requirements

- Unit tests for: PIN/password hashing, sanitizers (rooms, scenes, favorites, schedules), sunrise/sunset calculation with known coordinates, and schedule next-fire computation across DST changes.
- API tests for auth (including lockout and session invalidation), authorization on every write route, and validation errors.
- A fake LIFX device or simulator for CI, so the UDP path can be tested without real bulbs.
- A manual test checklist for real bulbs on a LAN: discovery, control, offline detection, scenes, and schedules.

## 8. Open Questions

1. Is the target a single household on one LAN, or should the backend support remote access?
2. Should the backend run on the same machine as the bulbs, or on a separate host (for example a Raspberry Pi)?
3. Which database is preferred: SQLite (simple, single file) or PostgreSQL (if multiple users or hosts are needed)?
4. Are roles needed, or are all accounts equal?
5. Is a remote-access requirement in scope? If so, reverse proxy and TLS setup must be documented.
6. Should cloud integrations (for example Home Assistant or Matter bridges) be considered later?
</content>
