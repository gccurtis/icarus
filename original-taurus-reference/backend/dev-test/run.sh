#!/usr/bin/env bash
# Run the dev-test suites. Each suite starts the service, makes real calls, and
# asserts the responses — the central check that the platform works.
#
# Suites are grouped so the intelligence-backed ones (which make real model calls
# and incur provider cost) can be run, or skipped, on their own:
#
#   ./dev-test/run.sh              # every suite
#   ./dev-test/run.sh free         # only suites that make no model calls (no cost)
#   ./dev-test/run.sh intelligence # only the intelligence-backed suites (cost)
#
# Each intelligence suite reports its own cost; when any run, the runner also
# prints the total across them.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

mode="${1:-all}"
case "$mode" in
  all | free | intelligence) ;;
  *) echo "usage: run.sh [all|free|intelligence]"; exit 2 ;;
esac

# The suites that make real model calls (and skip without a key). Everything else
# runs offline at no cost. Padded with spaces for whole-word matching.
#
# This list is derived from measurement, not intent: it is every suite whose run
# emits per-call telemetry. It previously named only eight, while fifteen were
# actually calling models — so `run.sh free` was spending money on seven suites it
# claimed were free. Each of those seven guards on an API key, which makes them
# runnable without one; it does not make them free when a key is present.
#
# Re-derive after adding a suite:
#   awk '/^═══ .* ═══$/{s=$2} /call: /{if(s!="")n[s]++} END{for(k in n) print k}' RUN.log
intelligence_suites=" action agents chat-attachments chats connector-context connectors context-binding context-scope generate intelligence knowledge knowledge-scale live-document notifications prompt prompt-persona web "

# Intelligence suites append their estimated cost here; the runner totals it.
COST_FILE="$(mktemp)"
export COST_FILE
trap 'rm -f "$COST_FILE"' EXIT

status=0
ran_intelligence=0
failed_suites=()
for suite in */run.sh; do
  name="${suite%/run.sh}"
  is_intel=0
  [[ "$intelligence_suites" == *" $name "* ]] && is_intel=1

  case "$mode" in
    free) [[ "$is_intel" -eq 1 ]] && continue ;;
    intelligence) [[ "$is_intel" -eq 0 ]] && continue ;;
  esac

  [[ "$is_intel" -eq 1 ]] && ran_intelligence=1
  label="$name"
  [[ "$is_intel" -eq 1 ]] && label="$name (intelligence)"
  printf '\033[1;36m═══ %s ═══\033[0m\n' "$label"
  if bash "$suite"; then
    :
  else
    # Record WHICH suite failed and with what code. A suite can exit non-zero
    # without printing a failed check (a build race, a trap, an early exit), and
    # a summary that only says "some suites failed" sends the reader hunting.
    failed_suites+=("$name (exit $?)")
    status=1
  fi
  echo
done

if [[ "$status" -eq 0 ]]; then
  printf '\033[1;32m═══ all suites passed ═══\033[0m\n'
else
  printf '\033[1;31m═══ some suites failed ═══\033[0m\n'
  for f in "${failed_suites[@]}"; do printf '\033[1;31m  ✗ %s\033[0m\n' "$f"; done
fi

# Total the cost across the intelligence-backed suites that ran.
if [[ "$ran_intelligence" -eq 1 && -s "$COST_FILE" ]]; then
  total="$(awk '{s += $1} END { printf "%.6f", s }' "$COST_FILE")"
  printf '\033[1;34m▶ total intelligence cost this run: $%s\033[0m\n' "$total"
fi

exit "$status"
