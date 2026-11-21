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

Docker prerequisites: Docker Engine with Compose v2, running on Linux or through Docker Desktop's WSL2 integration. The Dockerfile builds the React UI and runs the Python backend in one image. **Bridge networking is now the default**: `compose.yaml` publishes the selected host HTTP port (`./manage.sh port`, default 8080) to **container port 8080/tcp**, bound to `0.0.0.0` by default. For localhost-only HTTP binding, set `LIFX_BIND_ADDR=127.0.0.1` when launching the wrapper; do not expose the application directly to the internet.

**Native Linux host networking is optional** via `./manage.sh network` (select `host`). It uses `compose.host.yaml`, which does not publish Docker ports and has the backend listen directly on the host's configured port. Host networking is normally the best fit for LIFX UDP broadcast discovery and replies (bulb UDP port 56700). In **bridge networking**, automated broadcast discovery may fail behind Docker NAT or WSL2/Docker Desktop; add direct bulb IP addresses or subnet scans in app settings. Publishing the HTTP port does not expose bulb UDP/56700 and does not make broadcast discovery work. The Docker runtime uses the invoking user's UID/GID and mounts the checkout at `/data`, preserving the existing SQLite database. Ensure this user can write to the checkout. Host timezone is passed through for schedules.

`./manage.sh network` switches between bridge and host without deleting the database. If the app was running, the script removes the old container and restarts under the selected networking configuration; if stopped, it stays stopped.

## Management

```bash
./manage.sh start
./manage.sh stop
./manage.sh restart
./manage.sh status
./manage.sh logs           # Ctrl-C exits the log viewer
./manage.sh update         # Fast-forward git pull, rebuild, restart if needed
./manage.sh port           # Configure external HTTP port (bridge); restart afterward
./manage.sh network        # Switch Docker bridge/host networking
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
