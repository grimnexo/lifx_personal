# hl_lifx_control

A small local web service that discovers and controls LIFX lights **directly over your LAN**, with no cloud or internet involved. It serves a web page (`index.html`) and a JSON API, and talks to the bulbs using LIFX's local UDP protocol.

- Python 3.8+, **standard library only** (nothing to `pip install`)
- Single process: one UDP socket, four background threads, one HTTP server
- Built-in **schedules** (fixed times, sunrise, sunset) that run on the server even when no browser is open

## Version

Current build: **1.0.1** (see `VERSION` at the top of `hl_lifx_control.py`). The version is printed when the service starts, returned as `version` by `GET /api/state`, and shown at the bottom of the Settings menu. Every release ships with a `CHANGELOG.md` listing what changed and which files were updated. Releases use `MAJOR.MINOR.PATCH`: MAJOR for changes that break `config.json` or the API, MINOR for new features, PATCH for fixes.

## Files

| File | Purpose |
|---|---|
| `hl_lifx_control.py` | The service: LIFX protocol, discovery, light control, HTTP API |
| `web/` | The web UI: a Vite + React + TypeScript app styled with Tailwind CSS. Calls the API below |
| `index.html` | The original single-file UI. No longer served; kept for reference |
| `CHANGELOG.md` | What changed in each release, and which files were updated |
| `LICENSE` | MIT license |
| `.gitignore` | Keeps `config.json` (your location, IPs, groups, schedules) out of git |
| `config.json` | Created on first save: settings, groups, presets, schedules and user accounts (passwords and PINs stored as salted hashes). Safe to back up while the service is stopped; don't share it |

An older `data.json` is renamed to `config.json` automatically on startup if `config.json` doesn't exist yet.

## Running

Build the web app once (needs Node.js 20.19 or newer):

```
cd web
npm install
npm run build
cd ..
python3 hl_lifx_control.py
```

Then open `http://<machine-ip>:8080`. Use another port with `PORT=9000 python3 hl_lifx_control.py`. Until `web/dist` exists, the service answers the page with a message telling you to run the build.

### Developing the web app

```
cd web
npm run dev
```

The Vite dev server (usually `http://localhost:5173`) proxies `/api` to `http://localhost:8080`, so keep `hl_lifx_control.py` running alongside it. `npm run lint` checks the code and `npm run build` type-checks and builds the production bundle.

The web app has a sign-in page, a navigation bar, and these pages: Lights (the dashboard), Devices (a table of bulbs with status, address, and rename), and Profile (display name, theme and accent color, password, and PIN sign-in).

## Accounts and sign-in

The first run creates a development account with username `test` and password `test`. Change the password under Profile before exposing the service to anyone else. Each user can sign in with their password or, once set, a 4 to 8 digit PIN. Five failed attempts lock that username for one minute.

Sessions are kept in memory, so restarting the service signs everyone out. This is a simple local login, not a full authentication system. Only use it on your own network.

The machine must be on the same network (same subnet or VLAN) as the lights. Allow inbound UDP through the firewall (the lights reply to the service's UDP socket). Docker or WSL need host/bridged networking for broadcast discovery to work.

Every `/api` call except sign-in requires a session cookie. Do not expose the port to the internet.

## How it works

```
Browser (web/dist, React) --HTTP/JSON--> hl_lifx_control.py --UDP :56700--> LIFX bulbs
```

### Threads

| Thread | Function | Job |
|---|---|---|
| main | `ThreadingHTTPServer` + `Handler` | Serves the page and the JSON API (one thread per request) |
| receiver | `rx_loop()` | Reads every UDP reply and updates the in-memory `devices` dict |
| poller | `poll_loop()` / `poll_once()` | Repeatedly asks the network "who's there?" and each known bulb "what's your state?" |
| scheduler | `schedule_loop()` | Every 15 s, runs any schedule whose time has arrived (see Schedules) |

Shared state (`devices`) is guarded by a `threading.Lock`. Nothing about the lights is stored on disk; it is rebuilt from the network each run.

### LIFX LAN protocol (UDP port 56700)

Every message is a 36-byte header followed by a payload, little-endian. `packet()` builds it:

| Offset | Size | Field | Value used |
|---|---|---|---|
| 0 | 2 | size | total packet length |
| 2 | 2 | protocol/flags | `1024` (protocol) `\|` `0x1000` (addressable) `\|` `0x2000` (tagged, only for broadcasts) |
| 4 | 4 | source | fixed id `0x4C494658` (replies echo it; the receiver ignores packets without it) |
| 8 | 8 | target | the bulb's 6-byte MAC + 2 zero bytes (all zeros for broadcast) |
| 22 | 1 | flags | `res_required = 1` (ask the bulb to reply) |
| 23 | 1 | sequence | rolling 0-255 counter |
| 32 | 2 | type | message type (below) |

Message types used:

| Type | Name | Direction | Payload |
|---|---|---|---|
| 2 | GetService | to bulb/broadcast | none. Used for discovery |
| 3 | StateService | from bulb | service + port. Tells us a bulb exists and its IP |
| 101 | LightGet | to bulb | none. Requests full state |
| 107 | LightState | from bulb | hue, saturation, brightness, kelvin (4 x uint16), reserved, power (uint16), 32-byte label |
| 102 | LightSetColor | to bulb | reserved byte, hue, sat, bri, kelvin (4 x uint16), duration (uint32 ms) |
| 103 | SetWaveform | to bulb | reserved, transient (1), hue, sat, bri, kelvin (4 x uint16), period (uint32 ms), cycles (float32), skew (int16, 0 = 50%), waveform (uint8: 1 sine, 4 pulse). Drives all effects |
| 117 | LightSetPower | to bulb | level (uint16: `65535` on / `0` off), duration (uint32 ms) |

### Discovery

Each poll cycle (default every 3 s), `poll_once()`:

1. Sends GetService to the configured **broadcast address** and to `255.255.255.255`.
2. Sends GetService to each address in **Extra light IPs**.
3. If no lights are known yet, and then every 10th cycle, sends GetService **directly to every address** in the scan ranges (`scan_targets()`): the configured CIDR ranges, or the /24 around this machine's IP when none are set. This works even when broadcasts are blocked. Ranges larger than 1,024 addresses are ignored.
4. Sends LightGet to every known bulb to refresh its state.

When a StateService (3) arrives, `rx_loop()` records the bulb's MAC (from the header), IP and `seen` timestamp. When a LightState (107) arrives it stores hue/saturation/brightness/kelvin/power and the label.

A light is reported `online` if it was heard from within `poll x 4 + 3` seconds.

### Controlling a light

`set_light(device, changes)` turns API values into packets:

| API field | Range | Wire value |
|---|---|---|
| `h` hue | 0-360 degrees | `round(h / 360 * 65535)` |
| `s` saturation | 0-100 % | `round(s / 100 * 65535)` |
| `b` brightness | 0-100 % | `round(b / 100 * 65535)` |
| `k` kelvin | 1500-9000 | clamped to that range |
| `power` | true/false | LightSetPower `65535` / `0` |

Behaviour worth knowing:

- **Partial updates merge.** If you send only `b`, the hue, saturation and kelvin from the bulb's last known state are re-sent with it (LightSetColor always carries all four values).
- **Color vs. white.** LIFX has no mode flag. A bulb is "white" when saturation is `0` (kelvin then sets the tone) and "color" when saturation is above 0. To switch to white, send `{"s": 0, "k": 3500}`; to switch to color, send e.g. `{"s": 100, "h": 120}`.
- **Order.** If a request has both color and `power`, the color is sent first, then power.
- **Fade.** Both messages carry the **transition** setting (seconds, converted to milliseconds), so changes fade in rather than snap.
- **Optimistic state.** After sending, the local copy is updated immediately so the UI doesn't flicker; the next poll confirms the real values.
- Commands are fire-and-forget UDP. There is no retry; if a packet is lost, repeat the call.

## config.json

Written by the API (`PUT /api/groups`, `PUT /api/settings`):

```json
{
  "settings": {
    "broadcast": "192.168.1.255",
    "ips": ["192.168.1.50"],
    "scan": ["192.168.1.0/24"],
    "poll": 3.0,
    "transition": 0.5,
    "light_order": ["d073d5003344", "d073d5001122"],
    "lat": 40.71,
    "lon": -74.01
  },
  "groups": [
    {
      "id": "g1a2b3",
      "name": "Living room",
      "members": ["d073d5001122", "d073d5003344"],
      "presets": [
        {
          "id": "p9z8y7",
          "name": "Movie night",
          "lights": {
            "d073d5001122": { "label": "Lamp", "on": true, "h": 30, "s": 80, "b": 25, "k": 3500 }
          }
        }
      ]
    }
  ],
  "schedules": [
    { "id": "s1", "name": "Sunset indigo", "enabled": true,
      "when": { "type": "sunset", "offset": 0 },
      "days": [0, 1, 2, 3, 4, 5, 6],
      "action": { "type": "preset", "target": "g1a2b3", "preset": "p9z8y7" } },
    { "id": "s2", "name": "Lights out", "enabled": true,
      "when": { "type": "time", "time": "02:00" },
      "days": [0, 1, 2, 3, 4, 5, 6],
      "action": { "type": "off", "target": "all" } }
  ]
}
```

| Setting | Meaning | Default |
|---|---|---|
| `broadcast` | Broadcast address for discovery (use your subnet's, e.g. `192.168.1.255`) | `255.255.255.255` |
| `ips` | Extra light IPs to probe each cycle | `[]` |
| `scan` | CIDR ranges probed address-by-address (max 1,024 addresses each) | `[]` (auto /24) |
| `poll` | Seconds between poll cycles (minimum 1) | `3` |
| `transition` | Fade time in seconds for every change (minimum 0) | `0.5` |
| `light_order` | MACs in the order the page shows lights (set by dragging in the Lights section's Edit mode; unlisted lights go last, alphabetically) | `[]` |
| `lat`, `lon` | Your latitude/longitude in decimal degrees, needed only for sunrise/sunset schedules | `null` |

Groups are lists of light MACs. A group with `"hidden": true` gets no card on the page but still works in schedules and the API (handy for a "notification lights" group spanning the house). **Presets** live inside their group and snapshot only that group's lights. The server stores them as-is; applying a preset is done by the web page, which sends one light call per entry (see below).

## Effects (breathe, pulse, strobe)

Effects run **on the bulb itself** using LIFX's `SetWaveform` message (type 103) over the LAN, so they work with no internet or LIFX app. With `transient = 1` the bulb returns to its previous color on its own when the effect ends.

| Effect | Waveform | Period | Looks like |
|---|---|---|---|
| `breathe` | sine | 3 s | Fades to the effect color and back |
| `pulse` | pulse (square) | 1 s | Flashes to the effect color for half of each second |
| `strobe` | pulse (square) | 0.1 s | Rapid flashing, **capped at 60 seconds** |
| `flicker` | none (emulated by the server) | random, 0.15-0.4 s steps | Candle-style flicker: brightness wanders between roughly 25% and 100% of the light's level, with small hue (color) or warmth (white) wobble |

- **Flicker is different:** standard LIFX bulbs have no built-in flicker (the "Flame" effect is firmware on LIFX tile and Candle devices only). So the service itself sends each lit bulb a stream of short randomized `SetColor` commands (about 3-6 a second, each fading into the next) from `flicker_loop()`, then fades back to the saved color. Because the server drives it, flicker only runs while the service is running; stopping the service mid-flicker leaves the bulbs wherever the last command put them. Flicker takes `seconds` (max 3600, default 1 hour when toggled on) rather than `times`. Manual changes to a light, or `stop`, cancel it immediately.
- **Color:** if a `color` is given (`{"h":0,"s":100,"b":100}`), lights go to that color and back. If not (the **Fun** menu), each light uses its own color and dips to 3% (breathe) or off (pulse/strobe).
- **Lights that are off or unreachable are skipped.**
- **Length:** `times` gives the number of cycles (max 1000). With no `times`, breathe/pulse run for up to an hour until stopped. Strobe takes `seconds` (default 30, max 60).
- **State tracking:** while an effect runs, the service ignores the bulb's in-flight color reports and keeps the real configuration, so the page doesn't show dimming values and "stop" restores the exact original. Each light in `GET /api/state` has an `fx` field (`"breathe"`, `"pulse"`, `"strobe"` or `null`).
- **Stopping:** `stop` sends the saved color back with `SetColor`. Changing a light by hand also ends the service's tracking of the effect.
- **Safety:** strobing can trigger seizures in people with photosensitive epilepsy. The page asks for explicit confirmation (default "No") before starting a strobe or saving a strobe schedule.

## Schedules

Schedules live in `config.json` and are run by `schedule_loop()`, so they fire whether or not a browser is open (the service itself must be running).

| Field | Values |
|---|---|
| `when.type` | `"time"` (needs `when.time`, 24h `"HH:MM"`), `"sunrise"` or `"sunset"` (optional `when.offset` in minutes; negative = before) |
| `days` | Weekdays it runs, `0` = Monday ... `6` = Sunday |
| `action.type` | `"off"`, `"on"`, `"preset"`, `"breathe"`, `"pulse"`, `"flicker"` or `"strobe"` |
| `action.times` / `action.seconds` | Cycle count for breathe/pulse; seconds for strobe (max 60) and flicker (max 3600) |
| `action.color` | `{"hex":"#ff0000","h":0,"s":100,"b":100,"k":3500}` for the effect actions (`hex` is only used by the page) |
| `action.target` | `"all"` or a group id. `"preset"` needs a group |
| `action.preset` | Preset id (inside the target group) when `action.type` is `"preset"` |
| `enabled` | `false` pauses a schedule |
| `runs`, `manual_runs` | Counters kept by the server: times it fired on schedule, and times it was run with "Run now" (`POST /api/schedule/<id>/run`). Start at 0; ignored if sent to `PUT /api/schedules` |

- **Clock:** all times use the **server's** clock and timezone. Sunrise/sunset are calculated locally from `lat`/`lon` (`sun_event()`, accurate to a few minutes, no internet needed). If the sun doesn't rise or set that day (polar regions), the schedule skips it.
- **Firing:** `schedule_loop()` checks every 15 seconds. A schedule runs once per day, when its time has passed by less than 5 minutes. If the service was off at that time, the run is **skipped**, not made up later. Restarting inside the 5-minute window can run it again.
- **Presets:** applying a preset sends each saved light's color, brightness and power state, only for lights still in the group. A light that is offline at that moment misses it.
- `next` (the next run time, ISO format) is computed for `GET /api/state` and is never stored.

## HTTP API

Base URL: `http://<host>:8080`. All bodies and responses are JSON. Lights are identified by `mac`, a 12-character lowercase hex string with no separators (get them from `/api/state`). Examples use `curl`.

### `GET /api/state`

Everything the UI needs: current lights, groups (with presets), schedules (each with a `next` run time), settings, and diagnostics.

```
curl http://localhost:8080/api/state
```

```json
{
  "lights": [
    { "mac": "d073d5001122", "label": "Lamp", "ip": "192.168.1.50", "online": true,
      "on": true, "h": 30, "s": 80, "b": 25, "k": 3500 }
  ],
  "groups": [ ... ],
  "version": "1.0.1",
  "settings": { ... },
  "diag": { "local_ip": "192.168.1.10", "replies": 42 }
}
```

`h` 0-360, `s` and `b` 0-100 (percent), `k` kelvin. `diag.replies` counts discovery replies received, which is handy for troubleshooting.

### `POST /api/light/<mac>`: control one light

Body fields are all optional: `power`, `h`, `s`, `b`, `k` (ranges above). Unspecified values keep the light's last known state.

```
# turn on
curl -X POST localhost:8080/api/light/d073d5001122 -H 'Content-Type: application/json' -d '{"power": true}'

# set to red at 60% brightness
curl -X POST localhost:8080/api/light/d073d5001122 -H 'Content-Type: application/json' -d '{"h": 0, "s": 100, "b": 60}'

# warm white at 80%
curl -X POST localhost:8080/api/light/d073d5001122 -H 'Content-Type: application/json' -d '{"s": 0, "k": 2700, "b": 80}'
```

Returns `{"ok": true}`. An unknown `mac` is silently ignored (still `ok: true`).

### `POST /api/all`: control every light

Same body as a single light, applied to every discovered light.

```
curl -X POST localhost:8080/api/all -H 'Content-Type: application/json' -d '{"power": false}'
```

### `POST /api/group/<group-id>`: control a group

Same body again, applied to the group's members. Group ids are in `/api/state` under `groups[].id`.

```
curl -X POST localhost:8080/api/group/g1a2b3 -H 'Content-Type: application/json' -d '{"power": true, "b": 40}'
```

Returns `{"ok": true}`, or `{"ok": false}` if the group id doesn't exist.

### Applying a preset by API

There is no dedicated endpoint; a preset is just a saved set of per-light values. Read it from `/api/state` and send each light its values, exactly as the web page does:

```
curl -X POST localhost:8080/api/light/d073d5001122 -H 'Content-Type: application/json' \
  -d '{"h": 30, "s": 80, "b": 25, "k": 3500, "power": true}'
```

### `PUT /api/groups`: save groups and presets

Replaces the **entire** group list (including presets) and writes `config.json`. Send the full list, usually fetched from `/api/state`, edited, then sent back. Group ids and preset ids are opaque strings you choose (the UI generates them).

```
curl -X PUT localhost:8080/api/groups -H 'Content-Type: application/json' -d '{
  "groups": [
    { "id": "kitchen", "name": "Kitchen", "members": ["d073d5001122"], "presets": [] }
  ]
}'
```

### `POST /api/effect/<group-id|light-mac|all>`: breathe, pulse or strobe

Body: `effect` (`breathe`, `pulse`, `flicker`, `strobe` or `stop`), plus optional `times`, `seconds` and `color` as described under Effects.

```
# flash group "upstairs" red at full brightness, 3 times, then return to normal
curl -X POST localhost:8080/api/effect/upstairs -H 'Content-Type: application/json' \
  -d '{"effect": "pulse", "times": 3, "color": {"h": 0, "s": 100, "b": 100}}'

# breathe every light in its own color until stopped
curl -X POST localhost:8080/api/effect/all -H 'Content-Type: application/json' -d '{"effect": "breathe"}'

# stop
curl -X POST localhost:8080/api/effect/all -H 'Content-Type: application/json' -d '{"effect": "stop"}'
```

Returns `{"ok": true}`; an unknown group or light gives 404 and a bad `effect` gives 400.

### `PUT /api/schedules`: save schedules

Replaces the **entire** schedule list (format above) and writes `config.json`.

```
curl -X PUT localhost:8080/api/schedules -H 'Content-Type: application/json' -d '{
  "schedules": [
    { "id": "s2", "name": "Lights out", "enabled": true,
      "when": { "type": "time", "time": "02:00" }, "days": [0,1,2,3,4,5,6],
      "action": { "type": "off", "target": "all" } }
  ]
}'
```

### `POST /api/schedule/<schedule-id>/run`: run a schedule now

Runs its action immediately, ignoring the time and day. Returns `{"ok": true}`, or `{"ok": false}` for an unknown id.

```
curl -X POST localhost:8080/api/schedule/s2/run
```

### `PUT /api/settings`: save settings

Any subset of the fields below; invalid values are ignored (an empty `lat`/`lon` clears it). Writes `config.json`.

```
curl -X PUT localhost:8080/api/settings -H 'Content-Type: application/json' -d '{
  "broadcast": "192.168.1.255",
  "ips": ["192.168.1.50"],
  "scan": ["192.168.1.0/24"],
  "poll": 3,
  "transition": 1.0,
  "lat": 40.71,
  "lon": -74.01
}'
```

### `POST /api/auth/login`: sign in

Send `{"username": "test", "password": "test"}` or `{"username": "test", "pin": "1234"}`. The reply sets a `lifx_session` cookie. `GET /api/auth/me` returns the signed-in user, and `POST /api/auth/logout` ends the session.

### `PUT /api/account`: update the signed-in user

Any of `name`, `theme` (`auto`, `light` or `dark`) and `accent` (`blue`, `teal`, `violet`, `amber` or `rose`). Changing the password (`newPassword`) or PIN (`pin`, or `""` to remove it) also requires `currentPassword`.

### `PUT /api/light/<mac>/label`: rename a light

`{"label": "Front porch"}`. Stores the name on the bulb itself.

### Responses and errors

| Status | Meaning |
|---|---|
| 200 | Success (`{"ok": true}` for control/save calls) |
| 401 | Not signed in (`{"ok": false, "error": "Not signed in"}`) |
| 404 | Unknown API path (`{"error": "not found"}`) |
| 500 | Server error or `config.json` couldn't be written: `{"ok": false, "error": "..."}`. Details are also printed in the service's terminal |

`GET /` (or any non-`/api` path) returns the built React app from `web/dist`.

## Code map (`hl_lifx_control.py`)

| Function / class | What it does |
|---|---|
| top of file | Loads `config.json` into `db`; creates the UDP socket (broadcast enabled) |
| `save()` | Writes `db` to `config.json` |
| `packet()` | Builds a LIFX packet (header + payload) |
| `tx()` | Sends a packet to an IP on port 56700 |
| `local_ip()`, `scan_targets()` | Work out which addresses to probe directly |
| `rx_loop()` | Receiver thread: parses replies (types 3 and 107) into `devices` |
| `poll_loop()`, `poll_once()` | Poller thread: discovery and state refresh each cycle |
| `u16()`, `set_light()` | Convert API units to wire units; send LightSetColor / LightSetPower |
| `apply()` | Runs `set_light()` for a list of MACs under the lock |
| `view()` | Converts a stored device to the API's JSON shape (degrees/percent, `online`) |
| `sun_event()`, `fire_time()`, `next_fire()` | Work out when a schedule fires, including sunrise/sunset |
| `run_effect()`, `stop_effect()` | Send SetWaveform / restore a light's saved color |
| `start_flicker()`, `flicker_step()`, `flicker_loop()` | Server-driven candle flicker thread |
| `run_action()`, `schedule_loop()` | Run a schedule's action; the scheduler thread |
| `Handler` | HTTP routing: `route()` wraps `_route()` so errors always return JSON |

## Troubleshooting

- **No lights found:** open Settings, then Network. Set the broadcast address to your subnet's (e.g. `192.168.1.255`; `10.69.1.255` only works on a /24), add a scan range, or add a light's IP. Check the "replies from lights" counter and that `local_ip` in `/api/state` is on the lights' network. Allow Python through the firewall for UDP.
- **Page can't reach the server:** open it at the address the terminal prints (not as a `file://`), and make sure nothing else is using the port. The service prints a clear message if the port is taken.
- **Changes revert or lights ignore commands:** UDP has no delivery guarantee on weak Wi-Fi. Repeat the command or lower the poll interval.
- **Settings won't save:** the error shown names the problem, usually `config.json` being read-only. Check the folder's permissions.

## License

MIT. See `LICENSE`. Source: https://github.com/Pyromancer3D/lifx_personal
