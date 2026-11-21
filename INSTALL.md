# Install and manage LIFX Personal

The `manage.sh` entrypoint supports **native directory-based** installation and **Docker Compose on Linux**. Both modes use `lifx.db` in the repository root and keep existing legacy `config.json` / `data.json` available for migration. LIFX is a LAN-only application; **never expose its HTTP port directly to the public internet**.

## First install

Clone the repository, then run:

```bash
chmod +x manage.sh
./manage.sh                 # Interactive menu
# Or select one:
./manage.sh install native
./manage.sh install docker
```

Choose the HTTP port with `./manage.sh port` (default 8080), then visit `http://<server-LAN-IP>:8080`. First installation asks for a username and password of at least 12 characters. It does not overwrite any existing accounts. If upgrading from an existing `test` / `test` login, change it with `./manage.sh password` immediately.

Native prerequisites: Python 3.8+, Node.js 20.19+ or 22.12+ with npm. This mode runs Python directly from the checkout and builds the React UI in `web/dist`. Existing installations can continue using their original direct startup method.

Docker prerequisites: **native Linux** Docker Engine and Docker Compose v2. The Dockerfile builds the React UI and runs the Python backend in one image. Docker uses `network_mode: host` to permit LIFX UDP broadcast discovery and replies (port 56700). Docker bridge/WSL2 NAT/Docker Desktop network emulation cannot be relied on for broadcast discovery. Docker runs with the invoking user's UID/GID and mounts the checkout at `/data`, preserving the original SQLite database. Make sure the invoking user can write to the checkout. The host's time zone is passed through for schedules.

## Management

```bash
./manage.sh start
./manage.sh stop
./manage.sh restart
./manage.sh status
./manage.sh logs           # Ctrl-C exits the log viewer
./manage.sh update         # Fast-forward git pull, rebuild, restart if needed
./manage.sh port           # Configure the port; restart afterward
./manage.sh backup         # SQLite online backup to .lifx/backups/
./manage.sh password       # Reset account password and revoke its sessions
```

Runtime/port selection and native process logs are stored under `.lifx/` (ignored by Git). The script refuses to overwrite local tracked changes when updating. It stops a wrapper-managed instance before switching modes, and it does not delete the SQLite database. Store additional backups off-machine: the built-in backup lives on the same disk.

Docker automatically restarts after a host reboot via the `unless-stopped` policy. The native background process does **not** survive reboot unless you configure an OS service manager such as systemd.

## Existing direct run remains supported

```bash
cd web
npm ci
npm run build
cd ..
PORT=8080 python3 hl_lifx_control.py
```

The original direct-start development login behavior remains unchanged for compatibility. Wrapper-managed installations require administrator setup first. Do not run the native and Docker services simultaneously.

If devices are not discovered, verify that the host and bulbs share the appropriate LAN/VLAN, that inbound UDP replies are allowed, and that discovery broadcast or scan ranges are configured in Settings.
