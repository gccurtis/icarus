#!/usr/bin/env bash
# Compare whole CONFIGURATIONS against the live suites.
#
# The cast a caller sends is hard-coded in the application by design — nothing
# exposes model strength to a user — so the cast is part of what we test, never
# a knob a benchmark turns. What legitimately varies is which model a cast maps
# to, and that mapping lives in a config file. So a comparison here means
# pointing the suites at a DIFFERENT MANIFEST, never rewriting cast rows.
#
# Each variant is a complete manifest under etc/, differing from the shipped
# etc/config.yaml only in its cast tables, so any difference in results is
# attributable to the models and nothing else.
#
# The point is not a single green run. A model that passes once and fails twice
# is not usable, and a model that is cheaper per token but needs retries is not
# cheaper. Only repeated runs separate the two, which is why REPS defaults to 3.
#
# Usage:
#   ./dev-test/bench-models.sh                       # shipped config only
#   REPS=5 ./dev-test/bench-models.sh etc/config.yaml etc/config.cheap.yaml
#
# Each argument is a path to a manifest; the basket is named after its file.
# Results land in dev-test/.bench/results.tsv (git-ignored), summarised at the end.

set -uo pipefail # deliberately not -e: failing runs are the measurement
cd "$(dirname "${BASH_SOURCE[0]}")/.."

REPS="${REPS:-3}"
OUT_DIR="dev-test/.bench"
RESULTS="$OUT_DIR/results.tsv"
mkdir -p "$OUT_DIR"

configs=("$@")
[[ ${#configs[@]} -eq 0 ]] && configs=("etc/config.yaml")

# strip_ansi — the suite output is coloured; parsing needs it plain.
strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }

# parse_run LOGFILE BASKET REP — append one row per suite, plus the run's cost.
parse_run() {
  local log="$1" basket="$2" rep="$3"
  strip_ansi <"$log" | awk -v basket="$basket" -v rep="$rep" -v results="$RESULTS" '
    /^═══ .* \(intelligence\) ═══$/ {
      # A suite still pending when the next one starts never printed a verdict —
      # it died mid-run. Record it here rather than overwriting it, or a run that
      # killed a suite reads as one that simply had fewer suites.
      if (suite != "") print basket "\t" rep "\t" suite "\tdied\t" >> results
      suite = $2
      next
    }
    /^  ✓ all checks passed$/ {
      if (suite != "") { print basket "\t" rep "\t" suite "\tpass\t" >> results; suite = "" }
      next
    }
    /^  ✗ [0-9]+ check\(s\) failed$/ {
      if (suite != "") { print basket "\t" rep "\t" suite "\tfail\t" $2 >> results; suite = "" }
      next
    }
    /^▶ total intelligence cost this run: \$/ {
      cost = $NF; sub(/^\$/, "", cost)
      print basket "\t" rep "\tTOTAL\tcost\t" cost >> results
    }
    END {
      if (suite != "") print basket "\t" rep "\t" suite "\tdied\t" >> results
    }
  '
}

: >"$RESULTS"
printf '\033[1;36m═══ config comparison: %s manifest(s) × %s rep(s) ═══\033[0m\n' "${#configs[@]}" "$REPS"

for cfg in "${configs[@]}"; do
  if [[ ! -f "$cfg" ]]; then
    printf '\033[1;31m  ✗ no such manifest: %s\033[0m\n' "$cfg"
    continue
  fi
  name="$(basename "$cfg" .yaml)"
  printf '\n\033[1;36m▸ %s\033[0m  (%s)\n' "$name" "$cfg"
  for ((rep = 1; rep <= REPS; rep++)); do
    log="$OUT_DIR/${name}-rep${rep}.log"
    DEV_TEST_BASE_CONFIG="$(cd "$(dirname "$cfg")" && pwd)/$(basename "$cfg")" \
      ./dev-test/run.sh intelligence >"$log" 2>&1
    parse_run "$log" "$name" "$rep"
    passed="$(awk -F'\t' -v b="$name" -v r="$rep" '$1==b && $2==r && $4=="pass"' "$RESULTS" | wc -l)"
    bad="$(awk -F'\t' -v b="$name" -v r="$rep" '$1==b && $2==r && ($4=="fail" || $4=="died")' "$RESULTS" | wc -l)"
    cost="$(awk -F'\t' -v b="$name" -v r="$rep" '$1==b && $2==r && $3=="TOTAL" {print $5}' "$RESULTS")"
    printf '  rep %s: %s passed, %s failed  ($%s)\n' "$rep" "$passed" "$bad" "${cost:-?}"
  done
done

printf '\n\033[1;36m═══ summary ═══\033[0m\n'
awk -F'\t' '
  $3 != "TOTAL" { total[$1]++; if ($4 == "pass") ok[$1]++ }
  $3 == "TOTAL" { cost[$1] += $5; runs[$1]++ }
  END {
    printf "%-28s %-14s %-12s %s\n", "manifest", "suites passed", "pass rate", "avg $/run"
    for (b in total) {
      rate = total[b] ? (100 * ok[b] / total[b]) : 0
      avg  = runs[b] ? (cost[b] / runs[b]) : 0
      printf "%-28s %-14s %-12s %.6f\n", b, ok[b] "/" total[b], sprintf("%.0f%%", rate), avg
    }
  }
' "$RESULTS" | sort

printf '\nper-suite failures:\n'
awk -F'\t' '$4=="fail" || $4=="died" { print "  " $1 "  " $3 "  (" $4 ")" }' "$RESULTS" | sort | uniq -c | sort -rn

printf '\nrows: %s\n' "$RESULTS"
