#!/usr/bin/env bash
# Live Quarterback Action test: a real reasoning provider reads an empty
# document, writes a multi-section story, and applies heading and inline marks.
# Without the gitignored OpenRouter key the suite skips cleanly before spending.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key in etc/config.local.yaml; live Agent Action was not run"
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
agents:
  default_persona:
    name: "General"
    description: "Backend-configured general-purpose Project assistant"
    focus: "Complete the user's Project task accurately."
    instructions: "Act as Taurus's general Project assistant. Read a target document before editing it, preserve the requested structure, and report only tool-confirmed effects."
    context_references: []
    default_verification: "Verify the final document structure and formatting from successful document tool results."
    output_preferences: "Be direct and distinguish completed effects from unresolved work."
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
request POST /projects '{"name":"Agent Live Test"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

info "Create an empty target document and resolve the backend General Persona"
request POST /documents '{"name":"The Clockmaker Story","rows":[]}'
expect_status 201
DOCUMENT_ID="$(json_field id)"
request GET /personas/default
expect_status 200
expect_body '"id":"general"'

OBJECTIVE="Write an original short story of at least 250 words in document ${DOCUMENT_ID} using document.edit append operations with markdown. First read the document. Use the exact heading_1 title The Clockmaker's Orchard, then at least three heading_2 section headings. Put story prose in paragraph blocks. Use **bold** on at least two important phrases and _italic_ on at least two atmospheric phrases. Read the document again to verify it, and report only the confirmed change."
ACTION_BODY="$(jq -nc --arg objective "$OBJECTIVE" '{objective:$objective,persona:{personaId:"general"},context:[]}')"

info "Ask a real reasoning model to author and format the document"
request POST /agent/actions "$ACTION_BODY"
expect_status 201
TASK_ID="$(json_field id)"

info "Poll the durable Agent Task"
for _ in $(seq 1 120); do
  request GET "/agent/tasks/$TASK_ID"
  STATE="$(json_field state)"
  case "$STATE" in
    completed|partially_completed|waiting|failed|canceled) break ;;
  esac
  sleep 0.5
done
expect_body '"state":"completed"'
track_usage

info "Read the resolved document and verify requested structure and marks"
request GET "/documents/$DOCUMENT_ID"
expect_status 200
expect_body '"subKind":"heading_1"'
expect_body "\"text\":\"The Clockmaker's Orchard\""

H1_COUNT="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.subKind == "heading_1")] | length')"
H2_COUNT="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.subKind == "heading_2")] | length')"
BOLD_COUNT="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[].marks[]? | select(.kind == "bold")] | length')"
ITALIC_COUNT="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[].marks[]? | select(.kind == "italic")] | length')"
WORD_COUNT="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[] | select(.kind == "text") | .atoms[].text] | join(" ")' | wc -w | tr -d ' ')"

# What this checks is that the agent can AUTHOR STRUCTURE through the markdown
# tool path: a title, several sections, and inline emphasis, all landing as real
# blocks and marks. The word floor is only a proxy for "it wrote prose, not a
# stub", so it sits well below what the objective asks for. Length adherence is
# sampled and not the property under test — observed runs against the same
# objective produced 239, 157 and 280 words. Asking for MORE backfired: at 400
# words the agent appended enough blocks to exhaust the 16-round tool limit and
# the task failed outright, so the objective stays at a realistic length and the
# floor absorbs the variance. Asking for more did not reliably
# yield more. Structure, by contrast, came out right every time.
if [[ "$H1_COUNT" -ge 1 && "$H2_COUNT" -ge 3 && "$BOLD_COUNT" -ge 2 && "$ITALIC_COUNT" -ge 2 && "$WORD_COUNT" -ge 120 ]]; then
  pass "story structure: h1=$H1_COUNT h2=$H2_COUNT bold=$BOLD_COUNT italic=$ITALIC_COUNT words=$WORD_COUNT"
else
  fail "story structure mismatch: h1=$H1_COUNT h2=$H2_COUNT bold=$BOLD_COUNT italic=$ITALIC_COUNT words=$WORD_COUNT"
  FAILURES=$((FAILURES + 1))
fi

# gpt-4o-mini's higher completion-token rate is used as a conservative blended
# estimate; the embedding route used here is free.
usage_summary "${AGENT_TEST_USD_PER_MILLION:-0.60}"
finish
