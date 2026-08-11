#!/usr/bin/env bash
# Automated dev-test for prompt-block personas (persona parity, live-document).
# A prompt block can select a project-local persona; the persona's instructions
# overlay the resolution's system messages, so the SAME prompt over the SAME
# evidence produces differently-shaped output under different personas.
#
# The two personas differ only in a format directive that is deterministically
# checkable and does not fight the "answer only from evidence" synthesis prompt:
# one writes in ALL CAPS, the other in all lowercase. The suite resolves the
# block under each and asserts the output's case, proving the persona actually
# shaped generation.
#
# Live only, like the prompt suite: real reasoning + embedding calls. Without an
# OpenRouter key in etc/config.local.yaml the suite SKIPS (CI-safe). It reports
# its token cost. Manual walkthrough in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the prompt-persona suite."
  info "A persona's effect on generation can only be judged against a real model;"
  info "add a key to etc/config.local.yaml (api_key: \"...\") to exercise this suite."
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

current_revision() {
  request GET "/documents/$1" >/dev/null
  printf '%s' "$LAST_BODY" | jq -r '.revision'
}

# set_block_persona DOC BLOCK PERSONA_ID — pin the block's persona at the current
# revision (version 0 resolves to the persona's current version).
SBP_N=0
set_block_persona() {
  local doc="$1" block="$2" pid="$3" rev
  rev="$(current_revision "$doc")"
  SBP_N=$((SBP_N + 1))
  request POST "/documents/$doc/changes" \
    "{\"submissionId\":\"sbp-$SBP_N\",\"expectedRevision\":$rev,\"operations\":[{\"op\":\"set_block_persona\",\"blockId\":\"$block\",\"blockPersona\":{\"id\":\"$pid\",\"version\":0}}]}"
  expect_status 201
}

answer_text() { json_field lastOutput; }

# Assert the answer has letters and none are lowercase (ALL CAPS), or none are
# uppercase (all lowercase). Digits/punctuation are ignored.
assert_all_caps() {
  local a; a="$(answer_text)"
  if [[ "$a" =~ [A-Za-z] && ! "$a" =~ [a-z] ]]; then pass "answer is ALL CAPS (persona applied)"
  else fail "answer is not all caps — answer: $a"; FAILURES=$((FAILURES + 1)); fi
}
assert_all_lower() {
  local a; a="$(answer_text)"
  if [[ "$a" =~ [A-Za-z] && ! "$a" =~ [A-Z] ]]; then pass "answer is all lowercase (persona applied)"
  else fail "answer is not all lowercase — answer: $a"; FAILURES=$((FAILURES + 1)); fi
}

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Persona Project"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

echo
info "Index a grounding source so resolution has evidence to answer from"
request POST /documents '{"name":"Source","rows":[{"blocks":[
{"kind":"text","atoms":[{"kind":"text","text":"The Eiffel Tower is 300 meters tall and stands on the Champ de Mars in Paris."}]}
]}]}'
expect_status 201
SRC_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$SRC_ID"; expect_status 201; track_usage

echo
info "Create two personas that differ only in a checkable format directive"
request POST /personas '{"name":"Shouter","description":"caps","definition":{"behavioralGuidance":"Formatting rule that overrides all other style guidance: write your entire response in ALL UPPERCASE LETTERS."}}'
expect_status 201
CAPS_PID="$(printf '%s' "$LAST_BODY" | jq -r '.persona.id')"
request POST /personas '{"name":"Whisperer","description":"lower","definition":{"behavioralGuidance":"Formatting rule that overrides all other style guidance: write your entire response in all lowercase letters."}}'
expect_status 201
LOWER_PID="$(printf '%s' "$LAST_BODY" | jq -r '.persona.id')"

echo
info "Create a report with a prompt block over the source"
request POST /documents '{"name":"Report","rows":[{"blocks":[
{"id":"pb","kind":"prompt","data":{"instruction":"Describe the Eiffel Tower using the sources: its height and where it stands."}}
]}]}'
expect_status 201
REPORT_ID="$(json_field id)"

echo
info "Resolve under the ALL CAPS persona — the answer must be uppercase"
set_block_persona "$REPORT_ID" pb "$CAPS_PID"
resolve_wait "$REPORT_ID" pb reload
request GET "/documents/$REPORT_ID"; expect_status 200; expect_body '"status":"ok"'
assert_all_caps
track_usage

echo
info "Switch to the all-lowercase persona and refresh — the answer must flip to lowercase"
set_block_persona "$REPORT_ID" pb "$LOWER_PID"
# The op cleared ResolvedAt (personaId change), so refresh re-resolves.
request GET "/documents/$REPORT_ID"; expect_status 200
RESOLVED_AT="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].data.resolvedAt // "none"')"
# A cleared time.Time is the zero value, which serializes as 0001-01-01... (not
# omitted), so "cleared" means absent OR the zero time.
[[ "$RESOLVED_AT" == "none" || "$RESOLVED_AT" == 0001-* ]] && pass "set_block_persona cleared ResolvedAt" \
  || { fail "ResolvedAt not cleared: $RESOLVED_AT"; FAILURES=$((FAILURES + 1)); }
resolve_wait "$REPORT_ID" pb refresh
request GET "/documents/$REPORT_ID"; expect_status 200; expect_body '"status":"ok"'
assert_all_lower
track_usage

usage_summary 0.10

finish
