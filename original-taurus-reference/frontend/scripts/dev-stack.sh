#!/usr/bin/env bash
#
# Manage the Taurus Alpha + Omega development stack as one background process.
# The existing dev.sh remains the foreground runner and owns child cleanup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OMEGA_DIR="${TAURUS_OMEGA_DIR:-$ROOT_DIR/../taurus-omega}"
STATE_DIR="${TAURUS_DEV_STACK_STATE_DIR:-$ROOT_DIR/.taurus-dev}"
PID_FILE="$STATE_DIR/stack.pid"
LOG_FILE="$STATE_DIR/stack.log"
HEALTH_URL="https://localhost:5173/api/healthz"

usage() {
  cat <<'USAGE'
Usage: scripts/dev-stack.sh <start|stop|restart|status|logs>

  start    Start Alpha and Omega in the background and wait for health.
  stop     Stop only the managed Alpha and Omega process group.
  restart  Stop the managed stack, then start it again.
  status   Report process and health status.
  logs     Follow the combined Alpha and Omega log.
USAGE
}

fail() {
  echo "✗ $*" >&2
  exit 1
}

read_stack_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(<"$PID_FILE")"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s\n' "$pid"
}

stack_process_matches() {
  local pid="$1"
  local command_line
  kill -0 "$pid" 2>/dev/null || return 1
  command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$command_line" == *"$ROOT_DIR/scripts/dev.sh"* ]]
}

managed_stack_pid() {
  local pid
  pid="$(read_stack_pid)" || return 1
  stack_process_matches "$pid" || return 1
  printf '%s\n' "$pid"
}

clear_stale_pid() {
  local recorded
  recorded="$(read_stack_pid 2>/dev/null || true)"
  if [[ -n "$recorded" ]] && ! stack_process_matches "$recorded"; then
    unlink "$PID_FILE" 2>/dev/null || true
  elif [[ -z "$recorded" && -f "$PID_FILE" ]]; then
    unlink "$PID_FILE" 2>/dev/null || true
  fi
}

port_is_open() {
  local port="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null
}

validate_start() {
  command -v nohup >/dev/null || fail "nohup is required to start the managed stack."
  command -v curl >/dev/null || fail "curl is required for the stack health check."
  [[ -x "$ROOT_DIR/node_modules/.bin/vite" ]] ||
    fail "Alpha dependencies are missing. Run: nix develop --command pnpm install --frozen-lockfile"
  [[ -d "$OMEGA_DIR" ]] ||
    fail "Omega was not found at '$OMEGA_DIR'. Set TAURUS_OMEGA_DIR to its repository path."
  OMEGA_DIR="$(cd "$OMEGA_DIR" && pwd)"
  [[ -f "$OMEGA_DIR/etc/config.local.yaml" ]] ||
    fail "Omega needs etc/config.local.yaml with server.addr set to :8443."
  awk '$1 == "addr:" && $0 ~ /8443/ { found = 1 } END { exit !found }' \
    "$OMEGA_DIR/etc/config.local.yaml" ||
    fail "Omega etc/config.local.yaml must set server.addr to :8443 for Alpha's proxy."
  if port_is_open 5173; then
    fail "Port 5173 is already in use. Stop that process before starting Taurus."
  fi
  if port_is_open 8443; then
    fail "Port 8443 is already in use. Stop that process before starting Taurus."
  fi
}

start_stack() {
  mkdir -p "$STATE_DIR"
  clear_stale_pid
  local existing
  existing="$(managed_stack_pid 2>/dev/null || true)"
  if [[ -n "$existing" ]]; then
    echo "✓ Taurus development stack is already running (PID $existing)."
    echo "  App:  https://localhost:5173"
    echo "  Logs: $LOG_FILE"
    return
  fi

  validate_start
  : >"$LOG_FILE"
  set -m
  TAURUS_OMEGA_DIR="$OMEGA_DIR" nohup bash "$ROOT_DIR/scripts/dev.sh" \
    >>"$LOG_FILE" 2>&1 </dev/null &
  local pid=$!
  disown "$pid"
  set +m
  printf '%s\n' "$pid" >"$PID_FILE"

  for _ in {1..120}; do
    if ! stack_process_matches "$pid"; then
      unlink "$PID_FILE" 2>/dev/null || true
      tail -n 30 "$LOG_FILE" >&2 || true
      fail "The Taurus development stack exited during startup."
    fi
    if curl -skf --connect-timeout 1 --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      echo "✓ Taurus development stack is running (PID $pid)."
      echo "  App:  https://localhost:5173"
      echo "  Logs: $LOG_FILE"
      return
    fi
    sleep 0.25
  done

  stop_stack
  fail "The Taurus development stack did not become healthy within 30 seconds."
}

stop_stack() {
  clear_stale_pid
  local pid
  pid="$(managed_stack_pid 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "✓ Taurus development stack is not running."
    return
  fi

  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for _ in {1..40}; do
    if ! stack_process_matches "$pid"; then
      unlink "$PID_FILE" 2>/dev/null || true
      echo "✓ Taurus development stack stopped."
      return
    fi
    sleep 0.25
  done

  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  unlink "$PID_FILE" 2>/dev/null || true
  echo "✓ Taurus development stack was force-stopped after the shutdown timeout."
}

status_stack() {
  clear_stale_pid
  local pid
  pid="$(managed_stack_pid 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "Taurus development stack: stopped"
    return
  fi
  if curl -skf --connect-timeout 1 --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Taurus development stack: healthy (PID $pid)"
    echo "App:  https://localhost:5173"
  else
    echo "Taurus development stack: running but not healthy yet (PID $pid)"
  fi
  echo "Logs: $LOG_FILE"
}

logs_stack() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"
  tail -n 100 -f "$LOG_FILE"
}

case "${1:-}" in
  start) start_stack ;;
  stop) stop_stack ;;
  restart)
    stop_stack
    start_stack
    ;;
  status) status_stack ;;
  logs) logs_stack ;;
  *)
    usage
    exit 2
    ;;
esac
