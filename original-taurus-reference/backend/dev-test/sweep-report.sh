#!/usr/bin/env bash
# Regenerate the sweep report from whatever the sweep has FINISHED so far.
#
# The distinction matters and is easy to get wrong: a log for a run still in
# flight is a real file with real content, and feeding it to the report renders a
# half-finished run as a catastrophic failure — 4 suites passed, eleven "missing".
# It is the most misleading possible output, because it looks like data.
#
# status.tsv is the completion record: the sweep appends a row only after a run
# exits. So the set of finished runs is exactly the set named there, and this
# reports on that set and no other.
#
# Usage: ./dev-test/sweep-report.sh SWEEPDIR [OUT.md]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dir="${1:?usage: sweep-report.sh SWEEPDIR [OUT.md]}"
out="${2:-$here/../docs/test-reports/model-choice-sweep.md}"
status="$dir/status.tsv"
[[ -f "$status" ]] || { echo "no status.tsv in $dir — has the sweep started?" >&2; exit 1; }

logs=()
while IFS=$'\t' read -r model pass _exit _suites _secs; do
  [[ "$model" == "model" ]] && continue
  [[ -n "${model:-}" && -n "${pass:-}" ]] || continue
  f="$dir/$(printf '%s' "$model" | tr '/' '-').pass$pass.log"
  [[ -s "$f" ]] && logs+=("$f")
done < "$status"

[[ ${#logs[@]} -gt 0 ]] || { echo "no finished runs yet" >&2; exit 1; }

total="$(grep -vcE '^[[:space:]]*(#|$)' "$here/sweep-models.txt")"
done_runs=${#logs[@]}

"$here/model-report.sh" "${logs[@]}" > "$out.tmp"

# The progress line goes at the top, because a partial table read as a complete
# one is the whole hazard this script exists to avoid.
{
  head -n 1 "$out.tmp"
  printf '\n**Sweep in progress: %d finished runs, %d candidates.** Runs still in flight\n' "$done_runs" "$total"
  printf 'are excluded — a half-written log renders as a failing run, which looks like\n'
  printf 'data. Regenerate with `./dev-test/sweep-report.sh <dir>` as more land.\n'
  tail -n +2 "$out.tmp"
} > "$out"
rm -f "$out.tmp"
printf 'wrote %s from %d finished run(s)\n' "$out" "$done_runs"
