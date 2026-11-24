# Changelog

Each release lists what changed and which files were updated. Newest first.

Versions use `MAJOR.MINOR.PATCH`: MAJOR for changes that break `config.json` or the API, MINOR for new features, PATCH for fixes. The version is set in `hl_lifx_control.py` (`VERSION`) and shown in Settings.

## Unreleased — upstream 2.0.1 integration

### Backend integration
- Port upstream multi-step routines, per-action fades, smooth power-on color transitions, run cancellation and runtime progress, and server clock metadata.
- Import upstream split `.config/` data into a new SQLite database (preserving original files, accounts and all existing fork data). Keep the native/Docker installer and authentication.
- Original project: [Pyromancer3D/lifx_personal](https://github.com/Pyromancer3D/lifx_personal), upstream commits through `72cb2e2`.

## 1.1.0 - 2026-11-20

### Added
- Interactive native/Docker installer (`manage.sh`), Compose image, administrator bootstrap, SQLite backups, update and runtime controls, installation guide, and CI smoke tests.
- Configurable data directory for containers; native storage remains unchanged.
- Wrapper-managed startup requires account initialization rather than creating the default development login.

**Files updated:** `hl_lifx_control.py`, `README.md`, `.gitignore`, `CHANGELOG.md`; new deployment and testing files.

## 1.0.1 - 2026-11-19

Repository setup. No change to how the service or page behaves.

**Files updated:** `hl_lifx_control.py` (version number only), `README.md`, `CHANGELOG.md`, `LICENSE` (new), `.gitignore` (new)

### Added
- `LICENSE`: MIT license.
- `.gitignore`: keeps `config.json` (your home coordinates, light IPs, groups, presets and schedules) and `data.json`, Python caches and release zips out of the repository.

### Changed
- README: lists the new files, links to the repository at https://github.com/Pyromancer3D/lifx_personal, and has a License section.
- Version number is now 1.0.1.

## 1.0.0 - 2026-11-19

First numbered release. This is the stable baseline: everything built so far, before versions were tracked.

**Files updated:** `hl_lifx_control.py`, `index.html`, `README.md`, `CHANGELOG.md` (new)

### Added
- **Local control, no cloud:** the service talks to LIFX bulbs over the LAN (UDP 56700) and serves the web page and JSON API itself. Python standard library only (3.8+).
- **Discovery:** broadcast, direct scanning of address ranges (works when broadcasts are blocked), and manually added light IPs. Lights that stop responding show as not responding.
- **Light controls:** power switch, Color/White toggle, color picker, warmth slider (1500-9000 K), brightness slider, fade time setting. Each card shows its current state and IP address.
- **Groups:** create, rename and delete in Settings (delete asks for confirmation and warns when presets or schedules depend on the group). Group On/Off, group brightness, and **Set All** (one color or white setting for the whole group). **Hidden groups** have no card but still work in schedules. The group card's top edge shows the average color of its lights that are on. All on / All off for every light.
- **Presets:** saved per group (color/white, color, brightness, on/off per light). Apply, save over, rename, duplicate, delete, and drag to reorder.
- **Fun effects:** breathing, pulsing, candle flicker and strobe for groups and individual lights. Strobe asks for explicit confirmation first. Breathe, pulse and strobe run on the bulb; candle flicker is driven by the server.
- **Schedules:** run at a set time, sunrise or sunset (with minute offsets), on chosen days. Actions: turn on, turn off, apply a preset, or breathe / pulse / candle flicker / strobe in a chosen color. Run now, enable/disable, and "Times Activated" and "Manual Activations" counters. Schedules run on the server, so they work with no browser open.
- **Page layout:** collapsible Schedules, Groups and Lights sections, and collapsible cards (collapsed by default on phones and touch devices, expanded on desktop). Edit mode with drag-to-reorder for groups, lights and schedules. Automatic light/dark theme with an override in Settings. Light bulb favicon. Red banner at the top of the page for connection problems, shown only after repeated failures.
- **Settings:** groups, network (broadcast address, scan ranges, extra IPs, refresh interval), location for sunrise/sunset, fade time, theme, and the version number.
- **Storage:** settings, groups, presets, schedules and light order live in `config.json` (an older `data.json` is renamed automatically).
- **Docs:** README covering how the service controls the lights, the config format and every API call.
