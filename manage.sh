#!/usr/bin/env bash
# Single entrypoint for native and Docker LIFX installations on Linux.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATE="$ROOT/.lifx"
MODE_FILE="$STATE/mode"
PORT_FILE="$STATE/port"
PID_FILE="$STATE/lifx.pid"
LOG_FILE="$STATE/lifx.log"
DB_FILE="$ROOT/lifx.db"
COMPOSE_FILE="$ROOT/compose.yaml"
HOST_COMPOSE_FILE="$ROOT/compose.host.yaml"
NETWORK_FILE="$STATE/docker-network"

info() { printf '[lifx] %s\n' "$*"; }
fail() { printf '[lifx] ERROR: %s\n' "$*" >&2; exit 1; }
ensure_state() { mkdir -p -- "$STATE"; }

mode() {
  if [[ -f "$MODE_FILE" ]]; then
    local value
    value="$(<"$MODE_FILE")"
    case "$value" in native|docker) printf '%s' "$value";; esac
  fi
}
saved_port() {
  if [[ -f "$PORT_FILE" ]]; then
    printf '%s' "$(<"$PORT_FILE")"
  else
    printf '8080'
  fi
}
valid_port() {
  # Limit the digits before Bash arithmetic to avoid integer overflow on corrupted input.
  [[ "$1" =~ ^[0-9]{1,5}$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535))
}
port() {
  local value
  value="$(saved_port)"
  valid_port "$value" || fail 'Invalid saved port. Run ./manage.sh port to repair it.'
  printf '%d' "$((10#$value))"
}
port_for_repair() {
  local value
  value="$(saved_port)"
  if valid_port "$value"; then
    printf '%d' "$((10#$value))"
  else
    printf '8080'
  fi
}
port_display() {
  local value
  value="$(saved_port)"
  if valid_port "$value"; then
    printf '%d' "$((10#$value))"
  else
    printf 'invalid (choose option 8 to repair)'
  fi
}
validate_port() {
  valid_port "$1" || fail 'Port must be an integer from 1 to 65535.'
}
configure_port() {
  local proposed default_port
  default_port="$(port_for_repair)"
  if [[ "$(port_display)" == invalid* ]]; then
    info "Saved port is invalid; using $default_port as the replacement default."
  fi
  read -r -p "HTTP port [$default_port]: " proposed
  proposed="${proposed:-$default_port}"
  validate_port "$proposed"
  ensure_state
  printf '%d\n' "$((10#$proposed))" > "$PORT_FILE"
  info "Port set to $(port). Restart the service if already running."
}
require_mode() {
  [[ -n "$(mode)" ]] || fail 'No installation selected. Run ./manage.sh install native or ./manage.sh install docker.'
}
check_python() {
  command -v python3 >/dev/null || fail 'Python 3.8+ is required for native mode.'
  python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' || fail 'Python 3.8+ is required.'
}
check_node() {
  command -v node >/dev/null && command -v npm >/dev/null || fail 'Node.js and npm are required for native builds (Node 20.19+ or 22.12+).'
  node -e 'const [v,m]=process.versions.node.split(".").map(Number);process.exit((v===20&&m>=19)||(v===22&&m>=12)||v>22?0:1)' || fail 'Unsupported Node version. Use Node 20.19+ or 22.12+.'
}
check_docker() {
  [[ "$(uname -s)" == Linux ]] || fail 'Docker management requires Linux (including WSL2).']
  command -v docker >/dev/null || fail 'Docker Engine and the Compose plugin are required.'
  docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required (docker compose).'
  docker info >/dev/null 2>&1 || fail 'Docker daemon is unavailable or this user lacks Docker access.'
}
docker_network() {
  local selected=bridge
  [[ ! -f "$NETWORK_FILE" ]] || selected="$(<"$NETWORK_FILE")"
  case "$selected" in
    bridge|host) printf '%s' "$selected";;
    *) fail "Invalid Docker network mode in $NETWORK_FILE (expected bridge or host).";;
  esac
}
compose_for_network() {
  local selected="$1"
  shift
  local uid gid current_port compose_path
  uid="$(id -u)"; gid="$(id -g)"
  current_port="$(port)"
  case "$selected" in
    bridge) compose_path="$COMPOSE_FILE";;
    host) compose_path="$HOST_COMPOSE_FILE";;
    *) fail 'Docker network must be bridge or host.';;
  esac
  (cd "$ROOT" && PORT="$current_port" LIFX_UID="$uid" LIFX_GID="$gid" \
    docker compose -f "$compose_path" -p lifx-personal "$@")
}
compose() {
  compose_for_network "$(docker_network)" "$@"
}
configure_network() {
  require_mode
  [[ "$(mode)" == docker ]] || fail 'Docker networking can only be changed in Docker mode.'
  check_docker
  local current desired was_running=0
  current="$(docker_network)"
  read -r -p "Docker network [bridge/host] (current: $current): " desired
  desired="${desired:-$current}"
  case "$desired" in bridge|host) ;; *) fail 'Choose bridge or host.';; esac
  [[ "$desired" != "$current" ]] || { info "Docker network remains $current."; return; }
  if compose_for_network "$current" ps --status running --services | grep -Fxq lifx; then
    was_running=1
  fi
  # Compose changes network mode by replacing the container. Never run two
  # instances against the same SQLite database.
  compose_for_network "$current" down
  ensure_state
  printf '%s\n' "$desired" > "$NETWORK_FILE"
  if (( was_running )); then
    compose up -d --no-build
    info "Docker network switched to $desired; service restarted."
  else
    info "Docker network switched to $desired; service remains stopped."
  fi
}
native_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid args
  pid="$(<"$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  args="$(ps -p "$pid" -o args= 2>/dev/null || :)"
  [[ "$args" == *"$ROOT/hl_lifx_control.py"* ]] || return 1
  printf '%s' "$pid"
}
native_stop() {
  local pid i
  if ! pid="$(native_pid)"; then
    rm -f -- "$PID_FILE"
    info 'No wrapper-managed native process is running.'
    return
  fi
  kill -TERM "$pid"
  for ((i=0; i<30; i++)); do
    if ! native_pid >/dev/null; then
      rm -f -- "$PID_FILE"
      info 'Native service stopped.'
      return
    fi
    sleep 0.2
  done
  fail "Process $pid did not exit; investigate manually."
}
native_start() {
  check_python
  [[ -d "$ROOT/web/dist" ]] || fail 'Missing web/dist. Run ./manage.sh install native first.'
  local pid current_port
  current_port="$(port)"
  if pid="$(native_pid)"; then info "Native service already running (PID $pid)."; return; fi
  ensure_state
  rm -f -- "$PID_FILE"
  (
    cd "$ROOT"
    nohup env PYTHONUNBUFFERED=1 LIFX_REQUIRE_ADMIN=1 PORT="$current_port" \
      python3 "$ROOT/hl_lifx_control.py" >>"$LOG_FILE" 2>&1 </dev/null &
    echo $! > "$PID_FILE"
  )
  sleep 1
  if pid="$(native_pid)"; then
    info "Native service running (PID $pid): http://localhost:$(port)"
  else
    tail -n 20 "$LOG_FILE" >&2 || :
    fail 'Native service failed to start. Check the log or whether the port is already in use.'
  fi
}
stop_existing_mode_if_switching() {
  local desired="$1" current
  current="$(mode)"
  [[ -n "$current" && "$current" != "$desired" ]] || return 0
  info "Switching from $current to $desired; the same lifx.db is preserved."
  if [[ "$current" == native ]]; then native_stop; else check_docker; compose down; fi
}
bootstrap() {
  local selected="$1"
  if [[ "$selected" == native ]]; then
    python3 "$ROOT/scripts/bootstrap_user.py" --db "$DB_FILE"
  else
    compose run --rm --no-deps --entrypoint python3 lifx /app/scripts/bootstrap_user.py --db /data/lifx.db
  fi
}
install_native() {
  check_python; check_node
  stop_existing_mode_if_switching native
  info 'Installing the React UI locally (npm ci + build)...'
  (cd "$ROOT/web" && npm ci --no-audit --no-fund && npm run build)
  info 'Checking administrator account...'
  bootstrap native
  ensure_state
  printf 'native\n' > "$MODE_FILE"
  info 'Native installation ready. Existing database and legacy files were not overwritten.'
}
install_docker() {
  check_docker
  stop_existing_mode_if_switching docker
  info 'Building the Docker image (includes the frontend build)...'
  compose build
  info 'Checking administrator account...'
  bootstrap docker
  ensure_state
  printf 'docker\n' > "$MODE_FILE"
  info "Docker installation ready (network: $(docker_network)). Bridge exposes HTTP at http://localhost:$(port)."
}
install() {
  local selected="${1:-}"
  if [[ -z "$selected" ]]; then
    printf '1) Native (Python + locally built UI)\n2) Docker (bridge networking by default)\n'
    read -r -p 'Installation method [1]: ' selected
    case "${selected:-1}" in 1) selected=native;; 2) selected=docker;; *) fail 'Invalid option.';; esac
  fi
  case "$selected" in native) install_native;; docker) install_docker;; *) fail 'Choose native or docker.';; esac
  if [[ -t 0 ]]; then
    local answer
    read -r -p 'Start the application now? [Y/n]: ' answer
    [[ "$answer" =~ ^[Nn]$ ]] || start
  fi
}
start() {
  require_mode
  if [[ "$(mode)" == native ]]; then native_start
  else check_docker; compose up -d --no-build; info "Docker service launched: http://localhost:$(port)"; fi
}
stop() {
  require_mode
  if [[ "$(mode)" == native ]]; then native_stop
  else check_docker; compose stop; fi
}
restart() { stop; start; }
status() {
  require_mode
  local current_port
  current_port="$(port)"
  info "Mode: $(mode) | Port: $current_port | Database: $DB_FILE"
  if [[ "$(mode)" == docker ]]; then info "Docker network: $(docker_network)"; fi
  if [[ "$(mode)" == native ]]; then
    local pid
    if pid="$(native_pid)"; then info "Running (PID $pid)"; else info 'Not running under the wrapper'; fi
  else check_docker; compose ps; fi
}
logs() {
  require_mode
  if [[ "$(mode)" == native ]]; then
    [[ -f "$LOG_FILE" ]] || fail 'No native log yet.'
    tail -n 100 -f "$LOG_FILE"
  else check_docker; compose logs --tail 100 -f; fi
}
backup() {
  require_mode
  [[ -f "$DB_FILE" ]] || fail 'No lifx.db exists yet.'
  local destination relative
  ensure_state
  mkdir -p "$STATE/backups"
  destination="$STATE/backups/lifx-$(date +%Y%m%d-%H%M%S).db"
  relative=".lifx/backups/$(basename "$destination")"
  if [[ "$(mode)" == native ]]; then
    check_python
    python3 - "$DB_FILE" "$destination" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as target:
    source.backup(target)
PY
  else
    check_docker
    compose run --rm --no-deps --entrypoint python3 lifx -c 'import sqlite3,sys; a=sqlite3.connect(sys.argv[1]); b=sqlite3.connect(sys.argv[2]); a.backup(b); b.close(); a.close()' /data/lifx.db "/data/$relative"
  fi
  chmod 600 "$destination" 2>/dev/null || :
  info "Database backup created: $destination"
}
update() {
  require_mode
  [[ -d "$ROOT/.git" ]] || fail 'Updates require a Git checkout. Downloaded archives should be updated manually.'
  command -v git >/dev/null || fail 'git is required for updates.'
  [[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || fail 'Tracked files have local changes; commit or stash before updating.'

  local current_mode docker_was_running=0
  current_mode="$(mode)"
  if [[ "$current_mode" == docker ]]; then
    check_docker
    # Capture state before pulling: updated Compose files might change the service definition.
    if compose ps --status running --services | grep -Fxq lifx; then
      docker_was_running=1
    fi
  fi

  info 'Fetching fast-forward updates from the configured upstream branch...'
  git -C "$ROOT" pull --ff-only
  if [[ "$current_mode" == native ]]; then
    check_python; check_node
    (cd "$ROOT/web" && npm ci --no-audit --no-fund && npm run build)
    if native_pid >/dev/null; then native_stop; native_start; fi
  elif (( docker_was_running )); then
    compose up -d --build
  else
    compose build
    info 'Docker service was stopped before the update and has been left stopped.'
  fi
  info 'Update complete. Your lifx.db was preserved.'
}
password() {
  require_mode
  if [[ "$(mode)" == native ]]; then check_python; python3 "$ROOT/scripts/bootstrap_user.py" --db "$DB_FILE" --reset
  else check_docker; compose run --rm --no-deps --entrypoint python3 lifx /app/scripts/bootstrap_user.py --db /data/lifx.db --reset; fi
}
usage() {
  cat <<'HELP'
Usage: ./manage.sh [command]
  (no command)             Interactive menu
  install [native|docker]   Build and configure an installation
  start | stop | restart    Control the configured runtime
  status | logs             Inspect the service (Ctrl-C exits logs)
  update                    Pull fast-forward changes and rebuild
  port                      Change HTTP port (restart afterward)
  backup                    Safely back up live SQLite database
  password                  Reset a local account password
  network                   Switch Docker bridge/host networking
  help                      Show this help

Bridge mode publishes host PORT -> container 8080/tcp (works with Docker Desktop).
Host mode is intended for native Linux LAN discovery; it has no published ports.
Both modes preserve lifx.db in the repository directory. LAN use only.
HELP
}
menu() {
  while true; do
    printf '\n=== LIFX Personal Manager ===\n'
    printf 'Mode: %s | Port: %s\n' "$(mode)" "$(port_display)"
    printf '1) Install / switch runtime\n2) Start\n3) Stop\n4) Restart\n5) Status\n6) Logs\n7) Update\n8) Change port\n9) Back up database\n10) Reset password\n11) Docker network\n0) Exit\n'
    local choice
    read -r -p 'Select: ' choice || return
    case "$choice" in
      1) install;; 2) start;; 3) stop;; 4) restart;; 5) status;;
      6) logs;; 7) update;; 8) configure_port;; 9) backup;;
      10) password;; 11) configure_network;; 0) return;; *) info 'Invalid option.';;
    esac
  done
}
case "${1:-}" in
  '') menu;;
  install) install "${2:-}";;
  start) start;; stop) stop;; restart) restart;; status) status;; logs) logs;;
  update) update;; port) configure_port;; backup) backup;; password) password;;
  network) configure_network;;
  help|-h|--help) usage;; *) usage; exit 2;;
esac
