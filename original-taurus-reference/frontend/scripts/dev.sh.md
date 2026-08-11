# scripts/dev.sh — breakdown

Companion to [dev.sh](dev.sh). Runs the cockpit (Vite) and the Taurus Omega
backend together with one command (`pnpm dev:all`), and stops both cleanly on
Ctrl-C. The backend runs in its own nix devShell, so no host Go toolchain is
needed.

## Header and setup

### Docs, shell options, and repo root

```bash
#!/usr/bin/env bash
#
# Run the Taurus Alpha cockpit (Vite, HTTPS) and the Taurus Omega backend
# together. Ctrl-C (or either process exiting) stops both.
#
# Backend location: $TAURUS_OMEGA_DIR (default: ../taurus-omega, a sibling repo).
# The backend runs inside its own nix devShell, so a Go toolchain isn't required
# on the host.
set -uo pipefail

cd "$(dirname "$0")/.." # repo root
```

`set -uo pipefail` catches unset vars and pipeline failures (no `-e`, which would
fight the backgrounded pipelines and `wait`). `cd` to the repo root makes the
`../taurus-omega` default and `./node_modules/.bin/vite` path stable regardless of
where the script is invoked from.

## Locate the backend

### Resolve and validate the backend directory

```bash

OMEGA_DIR="${TAURUS_OMEGA_DIR:-../taurus-omega}"
if [ ! -d "$OMEGA_DIR" ]; then
  echo "✗ Taurus Omega backend not found at '$OMEGA_DIR'." >&2
  echo "  Set TAURUS_OMEGA_DIR to its path, e.g. TAURUS_OMEGA_DIR=~/code/taurus-omega pnpm dev:all" >&2
  exit 1
fi
```

The backend path defaults to the sibling `../taurus-omega` but is overridable via
`TAURUS_OMEGA_DIR`. If it doesn't exist, the script fails fast with a clear hint
rather than launching only half the stack.

## Cleanup trap

### Stop everything on exit or interrupt

```bash

# Stop every child (backend + frontend) when this script exits or is interrupted.
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT
```

A single trap on INT/TERM/EXIT clears itself (to avoid re-entry) and `kill 0`s the
whole process group — reliably taking down the backend (including the `core`
binary that `go run` spawns) and the frontend together, so nothing is orphaned on
`:8443` or the Vite port.

## Launch both

### Backend and frontend, prefixed and concurrent

```bash

echo "▶ Taurus Omega backend  ($OMEGA_DIR → https://127.0.0.1:8443)"
(cd "$OMEGA_DIR" && nix develop --command go run ./core) 2>&1 |
  awk '{ print "\033[34m[omega]\033[0m " $0; fflush() }' &

echo "▶ Taurus Alpha cockpit  (vite, https)"
./node_modules/.bin/vite dev 2>&1 |
  awk '{ print "\033[35m[alpha]\033[0m " $0; fflush() }' &

# Exit (and trigger cleanup) as soon as either side stops.
wait -n
```

Each service runs in the background, its output piped through `awk` that prefixes
and color-codes lines (`[omega]` blue, `[alpha]` magenta) with `fflush()` for
line-buffered output. The backend runs via `nix develop --command` (its own Go
toolchain); the frontend uses the repo-local Vite. `wait -n` returns the moment
either side exits, letting the trap tear the other down — so a crash on one stops
both instead of leaving a half-running stack.
