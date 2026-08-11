# scripts/dev-stack.sh — breakdown

Companion to [dev-stack.sh](dev-stack.sh). Provides explicit background start,
stop, restart, status, and combined-log commands for the existing foreground
Alpha/Omega development runner.

## Shebang, strict mode, and configuration

### Run under bash with fail-fast flags, then resolve paths and the health URL

```sh
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

```

`set -euo pipefail` makes any unset variable or failed command abort the script.
The configuration block resolves `ROOT_DIR` from the script's own location, locates
the sibling Omega checkout (overridable via `TAURUS_OMEGA_DIR`), and fixes the state
directory, PID file, log file, and the same-origin health URL used to confirm the
stack is up. This controller only manages the background lifecycle; `dev.sh` stays
the foreground runner that actually launches the services and owns child cleanup.

## Usage banner and failure helper

### Print the command list, and a single choke point for fatal errors

```sh
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

```

`usage` prints the command list via a single-quoted heredoc (`'USAGE'`, so nothing
inside is expanded). `fail` writes a marked message to stderr and exits non-zero — the
one choke point every validation check funnels through.

## Resolving the managed stack PID

### Read a valid recorded PID, confirm it is our live runner, and combine both

```sh
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

```

`read_stack_pid` returns the recorded PID only when the file exists and holds a
positive integer, rejecting empty or garbage contents. `stack_process_matches`
confirms a PID is both alive (`kill -0`) and actually our runner by matching
`dev.sh` in its command line — so a recycled PID belonging to some unrelated process
is never mistaken for the stack. `managed_stack_pid` composes the two, yielding a PID
only when the recorded process is live and ours.

## Clearing a stale PID file

### Delete the PID file when it no longer points at our runner

```sh
clear_stale_pid() {
  local recorded
  recorded="$(read_stack_pid 2>/dev/null || true)"
  if [[ -n "$recorded" ]] && ! stack_process_matches "$recorded"; then
    unlink "$PID_FILE" 2>/dev/null || true
  elif [[ -z "$recorded" && -f "$PID_FILE" ]]; then
    unlink "$PID_FILE" 2>/dev/null || true
  fi
}

```

`clear_stale_pid` removes the PID file when it points at a process that is no longer
our runner, or when the file lingers with no readable PID. This keeps a crashed or
reused PID from blocking a fresh start or misreporting status.

## Startup preflight checks

### Probe a port, then verify tools, checkouts, Omega config, and free ports

```sh
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

```

`port_is_open` probes a local port by trying to open a TCP connection to it.
`validate_start` gates startup: it requires `nohup` and `curl`, checks that Alpha's
dependencies are installed and the Omega checkout exists, canonicalizes `OMEGA_DIR`,
and insists (via an `awk` scan) that Omega's local config binds `:8443` — the port
Alpha's proxy expects. Finally it refuses to start when either port 5173 or 8443 is
already occupied, so the managed stack never collides with another process.

## Starting the stack

### Short-circuit if healthy, else launch dev.sh detached and poll for health

```sh
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

```

`start_stack` short-circuits when a managed instance is already running, printing its
URLs. Otherwise it validates, truncates the log, and launches `dev.sh` under `nohup`
in its own process group (`set -m` … `disown`) so the whole tree can later be
signalled together, recording the launched PID. It then polls up to 120 times
(~30 s): if the process dies it dumps the log tail and fails; once the health URL
responds it reports success. A timeout falls through to `stop_stack` and a failure.

## Stopping the stack

### Signal the process group, wait, then escalate to SIGKILL

```sh
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

```

`stop_stack` resolves the managed PID (reporting cleanly when nothing runs), then
sends `SIGTERM` to the whole process group — falling back to the single PID — and
waits up to ~10 s for graceful exit, clearing the PID file on success. If the process
is still alive it escalates to `SIGKILL`, removes the PID file, and notes the forced
stop.

## Status reporting

### Distinguish stopped, healthy, and running-but-not-yet-healthy

```sh
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

```

`status_stack` reports `stopped` when no managed process is found; otherwise it
distinguishes a fully `healthy` stack (the health URL responds) from one that is
`running but not healthy yet`, and always prints where to find the logs.

## Following the logs

### Ensure the log exists, then tail and follow it

```sh
logs_stack() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"
  tail -n 100 -f "$LOG_FILE"
}

```

`logs_stack` ensures the state directory and log file exist, then tails and follows
the combined Alpha/Omega output so a caller can watch the running stack live.

## Command dispatch

### Route the first argument to a subcommand; usage-and-exit on anything else

```sh
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
```

The trailing `case` maps the first argument to the matching function, with `restart`
composing stop-then-start. Any unrecognized (or missing) argument prints usage and
exits `2`, distinguishing misuse from an operational failure (`fail` exits `1`).
