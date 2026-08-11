#!/usr/bin/env bash
# Automated dev-test for the prompt block — the full grounded-generation journey.
# It signs in, builds a source document, indexes it into the knowledge lattice,
# creates a second document with a prompt block that draws on the first, resolves
# it, changes the source and watches the change propagate on refresh, and shows
# the two stable non-answers: insufficient evidence and a contradiction.
#
# This only means anything against real models, so:
#   - With key: an OpenRouter key in etc/config.local.yaml drives real reasoning
#     (plan + synthesize) and embedding (retrieval) calls.
#   - No key (CI-safe): the suite SKIPS and exits 0.
#
# The injected manifest configures a reasoning cast (plan + synthesize, what
# documents.prompt uses: general/high/medium/medium) and an embedding cast (for
# retrieval). Tiny content keeps the cost negligible; every resolution records
# its token usage on the block, which the suite sums and reports. Manual
# walkthrough in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the prompt suite."
  info "Prompt-block resolution can only be judged against real models; add a key"
  info "to etc/config.local.yaml (api_key: \"...\") to exercise this suite."
  exit 0
fi

DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
knowledge:
  window:
    target_runes: 200
    overlap_runes: 40
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

# resolve_wait DOC BLOCK MODE — resolve a prompt block and poll its job to done.
resolve_wait() {
  local doc="$1" block="$2" mode="$3" job i
  request POST "/documents/$doc/blocks/$block/resolve" "{\"mode\":\"$mode\"}"
  expect_status 202
  job="$(json_field jobId)"
  for i in $(seq 1 60); do
    request GET "/dev/jobs/$job"
    [[ "$LAST_BODY" == *'"status":"done"'* ]] && return 0
    [[ "$LAST_BODY" == *'"status":"failed"'* ]] && { fail "resolve job failed: $LAST_BODY"; FAILURES=$((FAILURES + 1)); return 1; }
    sleep 0.5
  done
  fail "resolve job did not finish"
  FAILURES=$((FAILURES + 1))
}

# answer_text — the resolved block's answer as raw text (its lastOutput). The
# stability assertions target THIS, not the whole document JSON, which also
# carries the evidence spans (and so would match the source text, not the answer).
answer_text() { json_field lastOutput; }

# Document writes are revision-bound: a submission must carry the revision it was
# authored against, plus an idempotency key. current_revision reads the head so
# submit_op can quote it.
current_revision() { request GET "/documents/$1" >/dev/null; printf '%s' "$LAST_BODY" | jq -r '.revision'; }

SUBMIT_N=0
submit_op() { # DOC JSON_OP
  local doc="$1" op="$2" rev
  rev="$(current_revision "$doc")"
  SUBMIT_N=$((SUBMIT_N + 1))
  request POST "/documents/$doc/changes" "{\"submissionId\":\"op-$SUBMIT_N\",\"expectedRevision\":$rev,\"operations\":[$op]}"
  expect_status 201
}

assert_answer_has() {
  local a; a="$(answer_text)"
  if [[ "$a" == *"$1"* ]]; then pass "answer has: $1"
  else fail "answer missing '$1' — answer: $a"; FAILURES=$((FAILURES + 1)); fi
}
assert_answer_lacks() {
  local a; a="$(answer_text)"
  if [[ "$a" != *"$1"* ]]; then pass "answer omits: $1"
  else fail "answer should omit '$1' — answer: $a"; FAILURES=$((FAILURES + 1)); fi
}

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Prompt Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

# ---------------------------------------------------------------------------
info "Part 1: a prompt block grounded on a source, and change propagation"
# ---------------------------------------------------------------------------

echo
info "Create the source document (explicit ids so we can edit it) and index it"
request POST /documents '{"name":"Tower","rows":[{"id":"ar1","blocks":[
{"id":"ab1","kind":"text","atoms":[{"id":"aa1","kind":"text","text":"The Eiffel Tower is 300 meters tall. It stands on the Champ de Mars in Paris."}]}
]}]}'
expect_status 201
TOWER_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$TOWER_ID"
expect_status 201
track_usage

echo
info "Create a second document with a prompt block that draws on the source"
# The instruction asks for BOTH the height and the location, so the answer carries
# a changing fact (the height) and a stable one (the location). That lets the
# refresh below assert text stability: the location prose is preserved verbatim
# while only the height updates.
request POST /documents '{"name":"Report","rows":[{"blocks":[
{"id":"pb","kind":"prompt","data":{"instruction":"Describe the Eiffel Tower: how tall it is and where it stands. Answer only from the sources."}}
]}]}'
expect_status 201
REPORT_ID="$(json_field id)"

echo
info "Resolve it — grounded in the source (300 meters, Champ de Mars)"
resolve_wait "$REPORT_ID" pb reload
request GET "/documents/$REPORT_ID"
expect_status 200
expect_body '"status":"ok"'
expect_body '"evidence"'
expect_body "\"sourceId\":\"$TOWER_ID\""
assert_answer_has '300'
assert_answer_has 'Champ de Mars'
assert_answer_lacks '450'
track_usage

# Stability under change — the trap. We change ONLY the height in the source and
# refresh, several times. Each time the answer must (a) propagate the new height,
# (b) keep the unchanged location prose, and (c) NOT treat the prior answer's old
# height as a contradiction. The last one is intermittent on a small model, so we
# repeat it to shake out flakiness rather than trusting a single pass.
prev=300
for h in 450 275 512 189 333 617 208 741; do
  echo
  info "Change source height ${prev} → ${h} and refresh — expect stable propagation, not a contradiction"
  submit_op "$TOWER_ID" "{\"op\":\"set_atom_text\",\"blockId\":\"ab1\",\"atomId\":\"aa1\",\"setText\":\"The Eiffel Tower is ${h} meters tall. It stands on the Champ de Mars in Paris.\"}"
  request POST "/dev/knowledge/documents/$TOWER_ID"
  expect_status 201
  resolve_wait "$REPORT_ID" pb refresh
  request GET "/documents/$REPORT_ID"
  expect_status 200
  expect_body '"status":"ok"'
  expect_no_body '"status":"contradiction"'
  assert_answer_has "$h"
  assert_answer_has 'Champ de Mars'
  assert_answer_lacks "${prev} meters"
  track_usage
  prev=$h
done

# ---------------------------------------------------------------------------
info "Part 2: stable non-answers — insufficient evidence and contradiction"
# ---------------------------------------------------------------------------

echo
info "A prompt with no supporting evidence resolves to 'insufficient', not a guess"
request POST /documents '{"name":"Ask","rows":[{"blocks":[
{"id":"pb","kind":"prompt","data":{"instruction":"What is the boiling point of water in Celsius? Answer only from the sources."}}
]}]}'
expect_status 201
ASK_ID="$(json_field id)"
resolve_wait "$ASK_ID" pb reload
request GET "/documents/$ASK_ID"
expect_status 200
expect_no_body '"status":"ok"'
expect_body '"status":"insufficient"'
track_usage

echo
info "Add a source that contradicts the first on the tower's height"
request POST /documents '{"name":"Tower2","rows":[{"blocks":[
{"kind":"text","atoms":[{"kind":"text","text":"The Eiffel Tower is 900 meters tall, one of the shortest structures in Paris."}]}
]}]}'
expect_status 201
TOWER2_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$TOWER2_ID"
expect_status 201
track_usage

echo
info "A prompt over contradictory evidence resolves to 'contradiction', not a guess"
request POST /documents '{"name":"Conflict","rows":[{"blocks":[
{"id":"pb","kind":"prompt","data":{"instruction":"Exactly how tall is the Eiffel Tower? Answer only from the sources."}}
]}]}'
expect_status 201
CONFLICT_ID="$(json_field id)"
resolve_wait "$CONFLICT_ID" pb reload
request GET "/documents/$CONFLICT_ID"
expect_status 200
expect_no_body '"status":"ok"'
expect_body '"status":"contradiction"'
track_usage

# Every resolution records its usage on the block; the suite summed it above.
# The tokens blend embedding (retrieval) and gpt-4o-mini reasoning (plan +
# synthesize); the estimate uses a representative reasoning rate.
usage_summary 0.15

finish
