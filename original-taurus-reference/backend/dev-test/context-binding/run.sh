#!/usr/bin/env bash
# Automated dev-test for a prompt block bound to a CONTEXT (contexts capability
# Task 8, live-document Slice E follow-on). A template variable binds to
# {"kind":"context","id":...} instead of a single resource; at resolve time the
# document.ScopeResolver port expands that context to its resolved leaf set
# (core/wiring/document_scope.go → contexts.Contexts.Resolve), and retrieval is
# scoped to exactly those leaves. This proves the whole chain end to end:
#
#   POST /contexts (only doc A) → GET .../resolved (leaf origins, no model call)
#   → bind a document variable to the context → resolve a prompt block → the
#   answer reflects doc A's fact and never doc B's → PATCH the context to add
#   doc B → re-resolve (reload) → the (now doc-B) question can be grounded,
#   proving the CONTEXT's membership — not the block's own selection — drives
#   scope.
#
# Live only, like the sibling context-scope suite:
#   - With an OpenRouter key in etc/config.local.yaml: real plan + synthesize +
#     embedding calls drive scoped retrieval and generation.
#   - No key (CI-safe): the suite SKIPS and exits 0.
#
# Assertions target the invented facts (512m tower vs. 1400m bridge), not exact
# wording, so a small model's phrasing doesn't make the suite flaky.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the context-binding suite."
  info "Context-bound retrieval quality can only be judged against real models; add a"
  info "key to etc/config.local.yaml (api_key: \"...\") to exercise this suite."
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

# current_revision DOC — the document's current head revision, fetched fresh (a
# resolve bumps the document's revision, so this must not be assumed stale).
# The `>/dev/null` discards request's own stdout log line so it never corrupts
# the captured value via command substitution.
current_revision() {
  request GET "/documents/$1" >/dev/null
  printf '%s' "$LAST_BODY" | jq -r '.revision'
}

# submit_change DOC OPS_JSON — submit one operations array at the document's
# current revision, with a fresh submissionId each call.
CHG_N=0
submit_change() {
  local doc="$1" ops="$2" rev
  rev="$(current_revision "$doc")"
  CHG_N=$((CHG_N + 1))
  request POST "/documents/$doc/changes" \
    "{\"submissionId\":\"cb-$CHG_N\",\"expectedRevision\":$rev,\"operations\":$ops}"
  expect_status 201
}

answer_text() { json_field lastOutput; }
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

# Invented, mutually distinct facts so the model can only ground an answer in
# 512/1400 if the matching source was actually in retrieval scope.
TOWER_TEXT="The Meridian tower is 512 meters tall."
BRIDGE_TEXT="The Solace bridge spans 1400 meters."
INSTRUCTION_TOWER="How tall is the Meridian tower? Answer only from the sources."
INSTRUCTION_BRIDGE="How long is the Solace bridge? Answer only from the sources."

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Context Binding Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

echo
info "Create two source documents with distinct, retrievable facts, and index both"
request POST /documents "{\"name\":\"Meridian\",\"rows\":[{\"blocks\":[{\"kind\":\"text\",\"atoms\":[{\"kind\":\"text\",\"text\":\"$TOWER_TEXT\"}]}]}]}"
expect_status 201
DOC_A="$(json_field id)"
info "doc A (Meridian tower) id = $DOC_A"
request POST "/dev/knowledge/documents/$DOC_A"; expect_status 201; track_usage
request POST /documents "{\"name\":\"Solace\",\"rows\":[{\"blocks\":[{\"kind\":\"text\",\"atoms\":[{\"kind\":\"text\",\"text\":\"$BRIDGE_TEXT\"}]}]}]}"
expect_status 201
DOC_B="$(json_field id)"
info "doc B (Solace bridge) id = $DOC_B"
request POST "/dev/knowledge/documents/$DOC_B"; expect_status 201; track_usage

echo
info "Create a context that includes ONLY doc A"
request POST /contexts "{\"name\":\"Meridian only\",\"includes\":[{\"kind\":\"document\",\"id\":\"$DOC_A\"}]}"
expect_status 201
CONTEXT_ID="$(json_field id)"
info "context id = $CONTEXT_ID"

echo
info "Resolve the context directly — origins must contain doc A and not doc B, before any model call"
request GET "/contexts/$CONTEXT_ID/resolved"
expect_status 200
expect_body "\"id\":\"$DOC_A\""
expect_no_body "\"id\":\"$DOC_B\""

echo
info "Create the report: a template variable bound to the CONTEXT, plus a prompt block scoped to it"
request POST /documents "{\"name\":\"Tower Report\",\"rows\":[{\"blocks\":[{\"id\":\"pb\",\"kind\":\"prompt\",\"data\":{\"instruction\":\"$INSTRUCTION_TOWER\"}}]}]}"
expect_status 201
RPT_ID="$(json_field id)"
submit_change "$RPT_ID" '[{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"src"}]}}]'
submit_change "$RPT_ID" "[{\"op\":\"set_context_variable\",\"contextVarName\":\"src\",\"boundResource\":{\"kind\":\"context\",\"id\":\"$CONTEXT_ID\"}}]"
submit_change "$RPT_ID" '[{"op":"set_block_context","blockId":"pb","blockContext":{"include":["src"]}}]'

echo
info "Resolve — grounded in doc A only (512), never doc B (1400)"
resolve_wait "$RPT_ID" pb reload
request GET "/documents/$RPT_ID"
expect_status 200
expect_body '"status":"ok"'
assert_answer_has '512'
assert_answer_lacks '1400'
track_usage

echo
info "PATCH the context to also include doc B — resolved origins now carry both, still before any model call"
request PATCH "/contexts/$CONTEXT_ID" "{\"name\":\"Meridian + Solace\",\"includes\":[{\"kind\":\"document\",\"id\":\"$DOC_A\"},{\"kind\":\"document\",\"id\":\"$DOC_B\"}]}"
expect_status 200
request GET "/contexts/$CONTEXT_ID/resolved"
expect_status 200
expect_body "\"id\":\"$DOC_A\""
expect_body "\"id\":\"$DOC_B\""

echo
info "Re-resolve (reload) asking a doc-B question — the CONTEXT's new membership, not the block's own selection, now grounds it in 1400"
submit_change "$RPT_ID" "[{\"op\":\"set_prompt\",\"blockId\":\"pb\",\"setText\":\"$INSTRUCTION_BRIDGE\"}]"
resolve_wait "$RPT_ID" pb reload
request GET "/documents/$RPT_ID"
expect_status 200
expect_body '"status":"ok"'
assert_answer_has '1400'
track_usage

usage_summary 0.20

finish
