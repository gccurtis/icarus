#!/usr/bin/env bash
# Compute the ACTUAL cost of a run from its per-call telemetry.
#
# The cost line each suite prints is a partial, flat-rate estimate: track_usage
# scrapes "totalTokens" out of a response body with head -n1 and only where a
# suite calls it, then multiplies the total by a single rate. That misses every
# call a suite does not surface, and charges input and output at the same price
# when real models charge 4-8x more for output.
#
# This reads the "call:" telemetry lines instead — one per provider call, emitted
# by the intelligence boundary — and prices prompt and completion tokens
# separately at each model's own published rate.
#
# Usage:
#   ./dev-test/call-cost.sh RUN.log            # totals by model
#   ./dev-test/call-cost.sh RUN.log --subject  # totals by unit of work
set -euo pipefail

log="${1:?usage: call-cost.sh RUN.log [--subject]}"
group="${2:-}"

# Prices in USD per 1M tokens, input/output, from the OpenRouter catalogue
# (openrouter.ai/api/v1/models) on 2026-07-28. text-embedding-3-small is not in
# that catalogue; $0.02/1M is OpenAI's published input rate, and an embedding has
# no output tokens.
#
# Kept here rather than in the application because a price is an external fact
# about a vendor, not a property of the system: the core resolves casts to models
# and never needs to know what one costs.
read -r -d '' PRICES <<'EOF' || true
openai/gpt-5.6-luna 0.50 3.00
openai/gpt-5.6-luna-pro 0.50 3.00
openai/gpt-5.1 1.25 10.00
openai/gpt-5-mini 0.25 2.00
openai/gpt-4.1-mini 0.40 1.60
openai/gpt-4.1-nano 0.10 0.40
openai/gpt-4o-mini 0.15 0.60
openai/gpt-oss-120b 0.037 0.17
google/gemini-3-flash-preview 0.50 3.00
google/gemini-2.5-flash 0.30 2.50
anthropic/claude-haiku-4.5 1.00 5.00
anthropic/claude-3.5-sonnet 3.00 15.00
openai/text-embedding-3-small 0.02 0.00
EOF

printf '%-42s %6s %6s %10s %8s %10s\n' "$([[ "$group" == "--subject" ]] && echo SUBJECT || echo MODEL)" CALLS FAIL TOKENS SECONDS USD

sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -o 'call: .*' | awk -v prices="$PRICES" -v group="$group" '
BEGIN {
  n = split(prices, lines, "\n")
  for (i = 1; i <= n; i++) {
    if (split(lines[i], p, " ") == 3) { inRate[p[1]] = p[2]; outRate[p[1]] = p[3] }
  }
}
{
  op = $2
  # A subject, when present, sits in brackets between the operation and the
  # model, so the model is one field further along.
  if ($3 ~ /^\[/) { subject = substr($3, 2, length($3) - 2); model = $4 }
  else            { subject = "(none)"; model = $3 }

  total = 0; prompt = 0; secs = 0
  for (i = 1; i <= NF; i++) {
    if ($i == "tokens")        { total  = $(i-1) + 0 }
    if ($i ~ /^prompt\)/)      { t = $(i-1); gsub(/\(/, "", t); prompt = t + 0 }
    if ($i ~ /^[0-9.]+m?s,?$/ && secs == 0 && i > 3) {
      d = $i; sub(/,$/, "", d)
      if (d ~ /ms$/)     { sub(/ms$/, "", d); secs = d / 1000 }
      else if (d ~ /s$/) { sub(/s$/,  "", d); secs = d + 0 }
    }
  }
  completion = total - prompt
  if (completion < 0) completion = 0

  if (!(model in inRate)) { unpriced[model]++ }
  cost = prompt/1000000 * inRate[model] + completion/1000000 * outRate[model]

  key = (group == "--subject") ? subject : model
  calls[key]++; tok[key] += total; pr[key] += prompt; sec[key] += secs; usd[key] += cost
  allCalls++; allTok += total; allPr += prompt; allSec += secs; allUsd += cost
  if ($0 ~ /FAILED/) { failed[key]++; allFailed++ }
}
END {
  # Sorted by cost inside awk, so the pipeline stays a single stream — piping
  # through head/sort would let head consume rows out of the shared buffer.
  for (k in calls) {
    best = ""
    for (c in calls) if (!done[c] && (best == "" || usd[c] > usd[best])) best = c
    if (best == "") break
    done[best] = 1
    printf "%-42s %6d %6d %10d %8.1f %10.6f\n", best, calls[best], failed[best], tok[best], sec[best], usd[best]
  }
  printf "%-42s %6d %6d %10d %8.1f %10.6f\n", "TOTAL", allCalls, allFailed, allTok, allSec, allUsd
  if (allTok > 0) printf "\nprompt share: %.0f%%\n", allPr * 100 / allTok
  for (m in unpriced) printf "WARNING: no price for %s (%d call(s)) — cost understated\n", m, unpriced[m]
}
'
