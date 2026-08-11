#!/usr/bin/env bash
# check-format.sh — assert every Go file is gofmt-clean.
#
# Formatting drift is cheap to fix and expensive to ignore: once a few files are
# unformatted, `gofmt -l` stops being a usable signal, because a real mistake is
# lost among the known-bad ones. This keeps that list empty so it stays useful.
#
# Usage:  ./scripts/check-format.sh [path ...]   (default: core cmd)
# Exit:   0 = every file is formatted; 1 = one or more need `gofmt -w`.

set -euo pipefail

roots=("${@:-core cmd}")
# shellcheck disable=SC2068 # roots is intentionally word-split for the default case
unformatted="$(gofmt -l ${roots[@]} 2>/dev/null || true)"

if [ -n "$unformatted" ]; then
	echo "These files are not gofmt-clean:"
	echo "$unformatted" | sed 's/^/  /'
	echo
	echo "Fix with:  gofmt -w $(echo "$unformatted" | tr '\n' ' ')"
	echo "Remember each non-test core .go also needs its .go.md companion touched."
	exit 1
fi

echo "All Go files are gofmt-clean."
