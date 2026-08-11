#!/usr/bin/env bash
# Live Action test: a real reasoning model reads two documents and appends a
# synthesizing section to the second, using the block-markdown document tools
# (no byte-offset math). Skips cleanly without the gitignored OpenRouter key.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key in etc/config.local.yaml; live Action was not run"
  exit 0
fi

DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
jobs:
  # Faster polling and a single worker keep runs quick and deterministic.
  # max_attempts is deliberately NOT overridden: production retries a failed job
  # five times, and that retry is what absorbs a transient "model busy" from the
  # provider. Pinning it to 1 here made the suites fail on hiccups production
  # rides out — a test harness must not be less resilient than what it tests.
  workers: 1
  poll_interval: "100ms"
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Action Live Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create two source documents"
request POST /documents '{"name":"Solar","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"Solar panels convert sunlight into electricity via the photovoltaic effect and produce the most power on clear days around midday."}]}]}]}'
expect_status 201
DOC_A="$(json_field id)"
request POST /documents '{"name":"Wind","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"Wind turbines convert moving air into electricity and often generate the most power at night and in winter, when solar output is lowest."}]}]}]}'
expect_status 201
DOC_B="$(json_field id)"

info "Ask a real Action model to read both docs and append a synthesis to the second"
OBJ="Read document ${DOC_A} and document ${DOC_B} with document.get. Then append to document ${DOC_B} a heading_2 titled 'Synthesis' followed by a paragraph that combines the key facts from both documents about how solar and wind power complement each other across the day and seasons. Use document.edit append operations, then report only the confirmed change."
BODY="$(jq -nc --arg o "$OBJ" '{objective:$o,persona:{personaId:"general"},context:[]}')"
request POST /agent/actions "$BODY"; expect_status 201
TASK_ID="$(json_field id)"

info "Poll the durable Action task"
STATE="queued"
for _ in $(seq 1 180); do
  request GET "/agent/tasks/$TASK_ID"
  STATE="$(json_field state)"
  case "$STATE" in completed|partially_completed|failed|canceled) break ;; esac
  sleep 0.5
done
if [[ "$STATE" == "completed" ]]; then
  pass "action task finished: $STATE"
else
  fail "action task did not finish: $STATE"
  FAILURES=$((FAILURES + 1))
fi

# Sum the task's model usage across runs (planning + retrieval + answer).
TOKENS="$(printf '%s' "$LAST_BODY" | jq '[.runs[].usage | (.planning.totalTokens + .retrieval.totalTokens + .answer.totalTokens)] | add // 0')"
USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + TOKENS))
info "action task usage: ${TOKENS} tokens"

info "Verify document B gained a Synthesis section with new prose"
request GET "/documents/$DOC_B"; expect_status 200
H2="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.subKind=="heading_2")] | length')"
if [[ "$H2" -ge 1 ]] && printf '%s' "$LAST_BODY" | grep -qi "synthesis"; then
  pass "document B has a Synthesis heading (${H2} heading_2 blocks)"
else
  fail "document B missing the Synthesis section"
  FAILURES=$((FAILURES + 1))
fi
ROW_COUNT="$(printf '%s' "$LAST_BODY" | jq '.base.rows | length')"
PROSE="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[] | select(.kind=="text") | .atoms[].text] | join(" ")')"
info "document B now has ${ROW_COUNT} rows; appended prose (${#PROSE} chars): ${PROSE:0:180}"

usage_summary "${ACTION_TEST_USD_PER_MILLION:-0.60}"
finish
