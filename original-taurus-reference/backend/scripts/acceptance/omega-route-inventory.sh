#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

case "${1:-}" in
  "")
    ;;
  --update)
    export OMEGA_UPDATE_COMPLETION_INVENTORIES=1
    ;;
  *)
    echo "usage: $0 [--update]" >&2
    exit 2
    ;;
esac

go test ./core/transport -run '^TestCompletionRouteInventory$' -count=1
