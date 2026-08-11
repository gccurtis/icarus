#!/usr/bin/env bash
# Live "Create with AI" test: POST /resources/generate creates a document and a
# real reasoning model populates it via an agent Action. Skips cleanly without
# the gitignored OpenRouter key.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key in etc/config.local.yaml; live generation was not run"
  exit 0
fi

DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
jobs:
  workers: 1
  poll_interval: "100ms"
  max_attempts: 1
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Generate Live Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create with AI: generate a document from a prompt"
request POST /resources/generate '{"kind":"document","prompt":"Write a short explainer about the water cycle: evaporation, condensation, and precipitation."}'
expect_status 201
DOC_ID="$(printf '%s' "$LAST_BODY" | jq -r '.resource.id')"
TASK_ID="$(printf '%s' "$LAST_BODY" | jq -r '.taskId')"
if [[ -n "$DOC_ID" && "$DOC_ID" != "null" && -n "$TASK_ID" && "$TASK_ID" != "null" ]]; then
  pass "generation started: document $DOC_ID, task $TASK_ID"
else
  fail "generate response missing resource/task: $LAST_BODY"
  FAILURES=$((FAILURES + 1))
fi

info "Poll the populating Action task"
STATE="queued"
for _ in $(seq 1 180); do
  request GET "/agent/tasks/$TASK_ID"
  STATE="$(json_field state)"
  case "$STATE" in completed|partially_completed|failed|canceled) break ;; esac
  sleep 0.5
done
if [[ "$STATE" == "completed" ]]; then
  pass "generation task finished: $STATE"
else
  fail "generation task did not finish: $STATE"
  FAILURES=$((FAILURES + 1))
fi
TOKENS="$(printf '%s' "$LAST_BODY" | jq '[.runs[].usage | (.planning.totalTokens + .retrieval.totalTokens + .answer.totalTokens)] | add // 0')"
USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + TOKENS))
info "generation task usage: ${TOKENS} tokens"

info "The generated document has real content"
request GET "/documents/$DOC_ID"; expect_status 200
TEXT="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[].atoms[]?.text] | join(" ")')"
ROWS="$(printf '%s' "$LAST_BODY" | jq '.base.rows | length')"
if [[ "$ROWS" -ge 1 && "${#TEXT}" -ge 80 ]]; then
  pass "document populated: ${ROWS} rows, ${#TEXT} chars of text"
else
  fail "document looks empty: rows=$ROWS chars=${#TEXT}"
  FAILURES=$((FAILURES + 1))
fi
info "generated prose (first 180 chars): ${TEXT:0:180}"

usage_summary "${GENERATE_TEST_USD_PER_MILLION:-0.60}"
finish
