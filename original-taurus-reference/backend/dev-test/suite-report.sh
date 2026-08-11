#!/usr/bin/env bash
# Build one intelligence suite's test report from a set of full-suite run logs.
#
# One report covers one suite across every model that ran it, because that is the
# comparison worth making: the same steps, the same assertions, different models.
#
# The report is organised by CAST, not only by model. A cast — the
# (purpose, strength, speed, cost) tuple a caller asks for — is the only thing
# the application actually chooses; which model serves it is configuration. So
# "is this model better" is not a question with one answer: a model can win at
# general/high/medium/medium (where prompt blocks plan and synthesize) and lose
# at general/medium/medium/medium (where chat and agent work happens). A report
# that averaged over both would hide exactly the decision the config makes.
#
# Everything is measured. Token counts are the provider's own per-call usage,
# emitted at the intelligence boundary as "call:" telemetry. Cost is those counts
# at each model's published rate.
#
# Usage:
#   ./dev-test/suite-report.sh SUITE INDEX RUN.log [RUN.log ...]
#     SUITE  the suite directory name, e.g. live-document
#     INDEX  the report number within that suite's directory, e.g. 1
set -euo pipefail
suite="${1:?usage: suite-report.sh SUITE INDEX RUN.log [...]}"
index="${2:?report index required}"
shift 2
[[ $# -ge 1 ]] || { echo "at least one run log required" >&2; exit 2; }

# USD per 1M tokens, input/output, from the OpenRouter catalogue on 2026-07-29.
# Reasoning tokens have no separate price: they are a share of completion tokens
# and bill at the completion rate. text-embedding-3-small is absent from that
# catalogue; 0.02 per 1M is OpenAI's published input rate, and an embedding has
# no output.
# Rates come from dev-test/model-prices.tsv when it exists (refresh it with
# ./dev-test/model-prices.sh). The inline list below is the fallback for a
# machine with no catalogue fetched; a model in neither prices at 0.00, which
# reads as free rather than unknown, so keep the file fresh before a sweep.
PRICEFILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/model-prices.tsv"
read -r -d '' PRICES <<'EOF' || true
openai/gpt-5.6-luna 0.50 3.00
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
if [[ -f "$PRICEFILE" ]]; then PRICES="$(cat "$PRICEFILE")"; fi

# extract SUITE LOG -> one TSV line per fact, scoped to that suite's section.
# Per-call facts are emitted keyed by cast and operation so the report can group
# on either without re-reading the log.
extract() {
  sed 's/\x1b\[[0-9;]*m//g' "$2" | awk -v want="$1" -v prices="$PRICES" '
BEGIN {
  n = split(prices, L, "\n")
  for (i = 1; i <= n; i++) if (split(L[i], p, " ") == 3) { IN[p[1]] = p[2]; OUT[p[1]] = p[3] }
}
/^═══ .* ═══$/ { insuite = ($2 == want); next }
!insuite { next }
/^  ✓ all checks passed$/ { verdict = "pass"; next }
/^  ✗ [0-9]+ check\(s\) failed$/ { verdict = "fail"; next }
/^  ✓ / { checks++; next }
/^  ✗ / {
  checks++; failed++
  if (nerr < 6) { line = $0; sub(/^  ✗ /, "", line)
    if (length(line) > 150) line = substr(line, 1, 150) "…"
    errs[nerr++] = line }
  next
}
/call: / {
  rest = substr($0, index($0, "call: ")); nf = split(rest, F, " ")
  op = F[2]
  model = (F[3] ~ /^\[/) ? F[4] : F[3]
  tot = 0; pr = 0; co = 0; re = 0; secs = 0; tc = 0; rounds = 0; cast = "-"
  for (i = 1; i <= nf; i++) {
    if (F[i] == "cast")                              cast = F[i+1]
    if (F[i] == "tokens")                            tot = F[i-1] + 0
    if (F[i] ~ /^prompt,?$/)                       { t = F[i-1]; gsub(/\(/, "", t); pr = t + 0 }
    if (F[i] ~ /^completion/)                        co = F[i-1] + 0
    if (F[i] ~ /^reasoning[),]*$/)                   re = F[i-1] + 0
    if (F[i] == "round(s),")                         rounds = F[i-1] + 0
    if (F[i] == "tool" && F[i+1] ~ /^call\(s\)/)     tc = F[i-1] + 0
    if (F[i] == "(tools")                          { d = F[i+1]; gsub(/[),]/, "", d); TOOLSEC += dur(d) }
    if (F[i] == "—")                               { d = F[i+1]; sub(/,$/, "", d); secs = dur(d) }
  }
  sub(/,$/, "", cast)
  if (co == 0 && tot > pr) co = tot - pr
  usdin = pr/1000000 * IN[model]; usdout = co/1000000 * OUT[model]

  CALLS++; PR += pr; CO += co; RE += re; SEC += secs; TC += tc; ROUNDS += rounds
  USDIN += usdin; USDOUT += usdout
  if ($0 ~ /FAILED/) callfail++
  if (op == "reasoning" || op == "reason.tools" || op == "inference") primary[model]++
  any[model]++

  # Per (cast, operation): the grouping the report is built on.
  k = cast SUBSEP op
  if (!(k in seenk)) { seenk[k] = 1; casts[++ncast] = k }
  KCALLS[k]++; KPR[k] += pr; KCO[k] += co; KRE[k] += re; KSEC[k] += secs
  KUSD[k] += usdin + usdout; KMODEL[k] = model
  next
}
END {
  best = ""
  for (m in primary) if (best == "" || primary[m] > primary[best]) best = m
  if (best == "") for (m in any) if (best == "" || any[m] > any[best]) best = m
  printf "MODEL\t%s\t%s\t%s\n", best, IN[best], OUT[best]
  printf "VERDICT\t%s\t%d\t%d\n", (verdict == "" ? "-" : verdict), checks, failed
  printf "TOTALS\t%d\t%d\t%d\t%d\t%.3f\t%.3f\t%d\t%d\t%.6f\t%.6f\t%d\n",
    CALLS, PR, CO, RE, SEC, TOOLSEC, TC, ROUNDS, USDIN, USDOUT, callfail
  for (i = 1; i <= ncast; i++) {
    k = casts[i]; split(k, parts, SUBSEP)
    printf "CAST\t%s\t%s\t%s\t%d\t%d\t%d\t%d\t%.3f\t%.6f\n",
      parts[1], parts[2], KMODEL[k], KCALLS[k], KPR[k], KCO[k], KRE[k], KSEC[k], KUSD[k]
  }
  for (e = 0; e < nerr; e++) printf "ERR\t%s\n", errs[e]
}
function dur(d) {
  if (d ~ /ms$/)        { sub(/ms$/, "", d); return d / 1000 }
  if (d ~ /µs$/)        { sub(/µs$/, "", d); return d / 1000000 }
  if (d ~ /m[0-9.]+s$/) { split(d, mm, "m"); sub(/s$/, "", mm[2]); return mm[1] * 60 + mm[2] }
  if (d ~ /s$/)         { sub(/s$/, "", d); return d + 0 }
  return 0
}
'
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for lg in "$@"; do extract "$suite" "$lg" > "$TMP/$(basename "$lg").tsv"; done

printf '# %s — report %s\n\n' "$suite" "$index"
printf 'Date: %s\n\n' "$(date -u +%Y-%m-%d)"
printf 'What this suite does, step by step: [0-suite.md](0-suite.md)\n'
printf 'The suite itself: [dev-test/%s/run.sh](../../../../dev-test/%s/run.sh)\n\n' "$suite" "$suite"

printf 'Every number is measured. Token counts are the provider'"'"'s own per-call\n'
printf 'usage, captured at the intelligence boundary. Cost is those counts at each\n'
printf 'model'"'"'s published rate.\n\n'

printf 'The **cast** is what the application asks for — `purpose/strength/speed/cost`.\n'
printf 'Which model serves a cast is configuration, so the per-cast tables below are\n'
printf 'where a model choice is actually decided: a model can win at one cast and lose\n'
printf 'at another, and an average over both would hide that.\n\n'

printf '## Summary\n\n'
printf '| Model | Result | Checks | Failed | Calls | Tokens | Model time | Tool time | Cost (USD) |\n'
printf '| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
for f in "$TMP"/*.tsv; do
  awk -F'\t' '
    $1=="MODEL"   { m=$2 }
    $1=="VERDICT" { v=$2; ch=$3; fl=$4 }
    $1=="TOTALS"  { calls=$2; pr=$3; co=$4; sec=$6; tsec=$7; usd=$10+$11 }
    END { printf "| `%s` | %s | %d | %d | %d | %d | %.1fs | %.2fs | %.5f |\n", m, v, ch, fl, calls, pr+co, sec, tsec, usd }
  ' "$f"
done
echo

# Per cast + operation, models side by side. This is the table that answers
# "which model should serve this cast".
printf '## By cast\n\n'
CASTS="$(awk -F'\t' '$1=="CAST" { print $2"\t"$3 }' "$TMP"/*.tsv | sort -u)"
while IFS=$'\t' read -r cast op; do
  [[ -n "$cast" ]] || continue
  purpose="${cast%%/*}"
  printf '### `%s` — %s\n\n' "$cast" "$op"
  printf 'Purpose `%s`; served here by the model named in each row.\n\n' "$purpose"
  printf '| Model | Calls | Input | Output | Reasoning | Time | Cost (USD) |\n'
  printf '| --- | --- | --- | --- | --- | --- | --- |\n'
  for f in "$TMP"/*.tsv; do
    awk -F'\t' -v c="$cast" -v o="$op" '
      $1=="CAST" && $2==c && $3==o {
        printf "| `%s` | %d | %d | %d | %d | %.2fs | %.6f |\n", $4, $5, $6, $7, $8, $9, $10
      }
    ' "$f"
  done
  echo
done <<< "$CASTS"

for f in "$TMP"/*.tsv; do
  awk -F'\t' '
    $1=="MODEL"   { m=$2; pin=$3; pout=$4 }
    $1=="VERDICT" { v=$2; ch=$3; fl=$4 }
    $1=="TOTALS"  { calls=$2; PR=$3; CO=$4; RE=$5; SEC=$6; TSEC=$7; TC=$8; ROUNDS=$9; UIN=$10; UOUT=$11 }
    $1=="ERR"     { errs[ne++]=$2 }
    END {
      printf "## `%s`\n\n", m
      printf "Result: **%s** — %d checks, %d failed. %d provider calls", v, ch, fl, calls
      if (ROUNDS > 0) printf ", %d tool-loop round(s)", ROUNDS
      printf ".\n\n"

      printf "### Rates\n\n| Direction | USD per 1M tokens |\n| --- | --- |\n"
      printf "| Input | %s |\n| Output | %s |\n\n", pin, pout

      tok = PR + CO
      allsec = SEC + TSEC
      usd = UIN + UOUT
      printf "### Where it went\n\n"
      printf "| Call type | Volume | Volume share | Time | Time share | Cost (USD) | Cost share |\n"
      printf "| --- | --- | --- | --- | --- | --- | --- |\n"
      printf "| Input | %d tokens | %.1f%% | not separable | — | %.6f | %.1f%% |\n",
        PR, (tok ? PR*100/tok : 0), UIN, (usd ? UIN*100/usd : 0)
      printf "| Output | %d tokens | %.1f%% | not separable | — | %.6f | %.1f%% |\n",
        CO, (tok ? CO*100/tok : 0), UOUT, (usd ? UOUT*100/usd : 0)
      printf "| Model wait | — | — | %.2fs | %.1f%% | — | — |\n",
        SEC, (allsec ? SEC*100/allsec : 0)
      printf "| Tool calls | %d calls | — | %.2fs | %.1f%% | none | — |\n",
        TC, TSEC, (allsec ? TSEC*100/allsec : 0)
      printf "| Total | %d tokens | 100%% | %.2fs | 100%% | %.6f | 100%% |\n", tok, allsec, usd
      if (RE > 0) printf "\nOf the %d output tokens, %d were reasoning tokens. They bill at the output\nrate, so they are counted in the Output row rather than priced separately.\n", CO, RE
      printf "\nInput and output cannot be timed apart: the provider returns one latency per\n"
      printf "call, so Model wait is the whole of it. Tool time is our own handlers.\n"

      if (ne > 0) {
        printf "\n### Failures\n\n"
        for (i = 0; i < ne; i++) printf "- %s\n", errs[i]
      }
      printf "\n"
    }
  ' "$f"
done
