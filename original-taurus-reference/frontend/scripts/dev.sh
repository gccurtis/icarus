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

OMEGA_DIR="${TAURUS_OMEGA_DIR:-../taurus-omega}"
if [ ! -d "$OMEGA_DIR" ]; then
  echo "✗ Taurus Omega backend not found at '$OMEGA_DIR'." >&2
  echo "  Set TAURUS_OMEGA_DIR to its path, e.g. TAURUS_OMEGA_DIR=~/code/taurus-omega pnpm dev:all" >&2
  exit 1
fi

# Stop every child (backend + frontend) when this script exits or is interrupted.
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT

echo "▶ Taurus Omega backend  ($OMEGA_DIR → https://127.0.0.1:8443)"
(cd "$OMEGA_DIR" && nix develop --command go run ./core) 2>&1 |
  awk '{ print "\033[34m[omega]\033[0m " $0; fflush() }' &

echo "▶ Taurus Alpha cockpit  (vite, https)"
./node_modules/.bin/vite dev 2>&1 |
  awk '{ print "\033[35m[alpha]\033[0m " $0; fflush() }' &

# Exit (and trigger cleanup) as soon as either side stops.
wait -n
