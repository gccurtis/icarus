#!/usr/bin/env bash
# Run the intelligence group once per candidate model, N passes each, under
# bounds.
#
# One pass tells you whether a model can do the work. Several tell you whether it
# does so reliably, which is the property that matters: the failures worth acting
# on are the ones that repeat, and a single run cannot tell a real weakness from
# a bad sample. Cost, latency and token appetite fall out of the same logs.
#
# THE BOUNDS ARE THE POINT. A model that cannot do the work does not fail fast —
# it fails slowly, and expensively. z-ai/glm-4.7-flash returned an empty response
# to 17 of 88 structured calls; each one fell back to a second model that
# answered, so the run took longer than a healthy one and would have been
# recorded as a pass earned on someone else's work. Three bounds cut that short:
#
#   RUN_TIMEOUT        wall clock. A run that cannot finish in the time a
#                      healthy one takes has already told you what you needed.
#   TOKEN_BUDGET       a model that burns far more tokens than its peers for the
#                      same suites is not cheap, whatever its rate card says.
#   MAX_CALL_FAILURES  the decisive one. Calls failing en masse means the model
#                      cannot hold the contract — structured output, tool
#                      calling — and every further second is spent proving it
#                      again.
#
# Each writes a verdict into status.tsv rather than a bare non-zero exit, because
# "stopped at 90s having failed 20 calls" and "ran to completion and failed four
# suites" are different findings and must not read the same.
#
# The candidate substitutes the shipped primary wherever it appears, so a pass
# exercises the casts the product uses. Rows the substitution does not touch
# (strength: low, every embedding row) stay as configured.
#
# Resumable: a model whose log already exists is skipped, so an interrupted sweep
# continues rather than restarting. Re-run one candidate by deleting its log.
#
# Usage:
#   ./dev-test/sweep.sh OUTDIR MODELS.txt [PASSES]
# Env:
#   RUN_TIMEOUT=300 TOKEN_BUDGET=120000 MAX_CALL_FAILURES=3
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
out="${1:?usage: sweep.sh OUTDIR MODELS.txt [PASSES]}"
list="${2:?model list required}"
passes="${3:-2}"

# Defaults sized from what a GOOD run looks like, not from what a bad one took.
# The three runs that passed all 15 suites finished in 158s, 192s and 208s,
# spending 68k-79k tokens with zero failed calls. So:
#
#   300s     1.4x the slowest passing run — room for provider jitter, and a model
#            needing 400-600s is cut rather than indulged. Slow IS a failure:
#            latency is a product property, not a footnote to one.
#   120000   1.5x the heaviest passing run. Catches a runaway tool loop (one
#            observed Action burned 267k tokens alone) without touching normal
#            variation.
#   3        passing runs had ZERO failed calls. Three allows a couple of
#            transient 429s that the retry legitimately absorbs; more than that is
#            systematic, and glm-4.7-flash would have been cut within seconds.
#
# These are deliberately near the top of the healthy range rather than far above
# it. A bound set to accommodate the worst thing ever seen does not bound anything.
RUN_TIMEOUT="${RUN_TIMEOUT:-300}"
TOKEN_BUDGET="${TOKEN_BUDGET:-120000}"
MAX_CALL_FAILURES="${MAX_CALL_FAILURES:-3}"
mkdir -p "$out"

base="$(grep -m1 -oE 'strength: medium, speed: medium, cost: medium.*model: "[^"]+"' "$root/etc/config.yaml" \
        | sed -E 's/.*model: "([^"]+)".*/\1/')"
[[ -n "$base" ]] || { echo "could not read the shipped primary from etc/config.yaml" >&2; exit 1; }
echo "substituting for: $base"
echo "bounds: ${RUN_TIMEOUT}s, ${TOKEN_BUDGET} tokens, ${MAX_CALL_FAILURES} call failures"

# A run cannot say anything about a model if the binary under it does not
# compile. Nine runs were recorded as "0 suites in 10s" against a tree that had
# stopped building — indistinguishable, in status.tsv, from a model that failed
# everything, and the sweep happily kept going. Check once, up front, and refuse
# to start rather than manufacture fifty rows of that.
if ! ( cd "$root" && go build ./... ) >/dev/null 2>&1; then
  echo "the tree does not compile — a sweep against it measures nothing:" >&2
  ( cd "$root" && go build ./... ) 2>&1 | head -5 >&2
  exit 1
fi

# Record what was swept. A dirty tree is not the product, and a report that does
# not say so invites reading these numbers as if they described a release.
commit="$(cd "$root" && git rev-parse --short HEAD)"
dirty="$(cd "$root" && git status --porcelain | wc -l)"
echo "tree: $commit ($dirty uncommitted file(s))"
printf '%s\t%s\n' "$commit" "$dirty" > "$out/tree.txt"

status="$out/status.tsv"
[[ -f "$status" ]] || printf 'model\tpass\texit\tsuites_passed\tseconds\tverdict\n' > "$status"

# tokens_in LOG — total tokens the run has spent so far, read from telemetry.
tokens_in() {
  sed 's/\x1b\[[0-9;]*m//g' "$1" 2>/dev/null \
    | grep -oE ', [0-9]+ tokens' | awk '{s+=$2} END{print s+0}'
}
failures_in() { grep -c 'FAILED' "$1" 2>/dev/null || echo 0; }

while read -r model; do
  model="${model%%#*}"; model="$(printf '%s' "$model" | tr -d '[:space:]')"
  [[ -n "$model" ]] || continue
  slug="$(printf '%s' "$model" | tr '/' '-')"
  cfg="$out/config-$slug.yaml"
  sed "s|$base|$model|g" "$root/etc/config.yaml" > "$cfg"

  for p in $(seq 1 "$passes"); do
    log="$out/$slug.pass$p.log"
    if [[ -s "$log" ]]; then echo "skip $model pass $p (log exists)"; continue; fi
    echo "run  $model pass $p"
    start=$SECONDS
    : > "$log"
    ( cd "$root" && DEV_TEST_BASE_CONFIG="$cfg" ./dev-test/run.sh intelligence ) > "$log" 2>&1 &
    runner=$!

    verdict="completed"
    while kill -0 "$runner" 2>/dev/null; do
      sleep 10
      elapsed=$((SECONDS - start))
      fails="$(failures_in "$log")"
      toks="$(tokens_in "$log")"
      if   [[ "$fails" -ge "$MAX_CALL_FAILURES" ]]; then verdict="unusable:${fails}-call-failures"
      elif [[ "$elapsed" -ge "$RUN_TIMEOUT" ]];     then verdict="timeout:${elapsed}s"
      elif [[ "$toks"   -ge "$TOKEN_BUDGET" ]];     then verdict="over-budget:${toks}-tokens"
      else continue
      fi
      echo "  cut: $verdict"
      # The suite starts a service per suite; kill the tree, not just the runner,
      # or an orphaned core keeps its port and the next candidate cannot bind.
      pkill -P "$runner" 2>/dev/null
      kill -9 "$runner" 2>/dev/null
      pkill -f "DEV_TEST_BASE_CONFIG=$cfg" 2>/dev/null
      break
    done
    wait "$runner" 2>/dev/null; code=$?

    secs=$((SECONDS - start))
    ok="$(sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -c '✓ all checks passed')"
    printf '%s\t%d\t%d\t%s\t%d\t%s\n' "$model" "$p" "$code" "$ok" "$secs" "$verdict" >> "$status"
    printf '  -> %s: exit=%d suites=%s in %ds\n' "$verdict" "$code" "$ok" "$secs"

    # A model cut as unusable will be cut again on the next pass for the same
    # reason. Recording one verdict is the finding; paying for it twice is not.
    if [[ "$verdict" == unusable:* ]]; then
      echo "  skipping remaining passes for $model"
      break
    fi
  done
done < "$list"

echo "SWEEP DONE"
