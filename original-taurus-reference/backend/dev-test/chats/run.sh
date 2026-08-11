#!/usr/bin/env bash
# Live chat test (BR-AI-CHAT): a real reasoning provider answers an ask-mode chat
# turn grounded in an indexed Project document, and the turn surfaces its token
# usage. Without the gitignored OpenRouter key the suite skips before spending.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key in etc/config.local.yaml; live chat turn was not run"
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
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Chat Live Test"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

info "Create a source document and index it into the knowledge lattice"
DOC_BODY='{"name":"Solar Notes","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"Solar panels convert sunlight directly into electricity using the photovoltaic effect: photons knock electrons loose in silicon cells, and that flow of electrons is an electric current."}]}]}]}'
request POST /documents "$DOC_BODY"
expect_status 201
DOC_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$DOC_ID" ""
expect_status 201
track_usage   # embedding usage (free model)

info "Open an ask-mode chat bound to the document"
CHAT_BODY="$(jq -nc --arg rid "$DOC_ID" '{mode:"ask",title:"Solar Q&A",resourceId:$rid}')"
request POST /agent/chats "$CHAT_BODY"
expect_status 201
CHAT_ID="$(json_field id)"
expect_body '"mode":"ask"'

info "Post a real ask turn — a reasoning model answers, grounded in the source"
request POST "/agent/chats/$CHAT_ID/turns" '{"message":"How do solar panels make electricity?"}'
expect_status 200
track_usage   # the turn's summed reasoning usage

USER_BODY="$(printf '%s' "$LAST_BODY" | jq -r '.userTurn.body')"
ANSWER="$(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.body')"
ROLE="$(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.role')"
if [[ "$USER_BODY" == "How do solar panels make electricity?" && "$ROLE" == "agent" && -n "$ANSWER" && "$ANSWER" != "null" ]]; then
  pass "chat turn answered (${#ANSWER} chars): ${ANSWER:0:100}"
else
  fail "unexpected turn result: role=$ROLE answer=${ANSWER:0:80}"
  FAILURES=$((FAILURES + 1))
fi

info "History persists across the turn"
request GET "/agent/chats/$CHAT_ID"
expect_status 200
TURN_COUNT="$(printf '%s' "$LAST_BODY" | jq '.turns | length')"
if [[ "$TURN_COUNT" -eq 2 ]]; then
  pass "chat history has the 2 turns"
else
  fail "chat history has $TURN_COUNT turns, want 2"
  FAILURES=$((FAILURES + 1))
fi

info "A general-knowledge chat needs no Project evidence — triage skips retrieval"
request POST /agent/chats '{"mode":"ask","title":"General"}'
expect_status 201
GEN_CHAT="$(json_field id)"

request POST "/agent/chats/$GEN_CHAT/turns" '{"message":"What is 1 + 1? Reply with just the number."}'
expect_status 200
track_usage
ONE_PLUS_ONE="$(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.body')"
if printf '%s' "$ONE_PLUS_ONE" | grep -qE '(^|[^0-9])2([^0-9]|$)'; then
  pass "answered 1+1 with no docs → ${ONE_PLUS_ONE}"
else
  fail "did not answer 1+1 from general knowledge (got: ${ONE_PLUS_ONE})"
  FAILURES=$((FAILURES + 1))
fi

request POST "/agent/chats/$GEN_CHAT/turns" '{"message":"How many times does the letter r appear in the word strawberry? Reply with just the number."}'
expect_status 200
track_usage
info "r-in-strawberry (observed; letter-counting is a known LLM weak spot) → $(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.body')"

# gpt-4o-mini blended rate as a conservative estimate; the embedding route is free.
usage_summary "${CHAT_TEST_USD_PER_MILLION:-0.60}"
finish
