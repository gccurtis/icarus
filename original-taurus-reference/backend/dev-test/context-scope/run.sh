#!/usr/bin/env bash
# Automated dev-test for per-block context selection (live-document Slice E).
# A prompt block declares its own scope over the document's context variables —
# an include set and an exclude set of variable names — and resolution retrieves
# restricted to exactly includes − excludes.
#
# Part 1 binds variables to two indexed DOCUMENTS; Part 2 binds them to two live
# CONNECTOR resources synced from external watchers. Scope resolution is
# kind-agnostic (a variable's ResourceRef.Kind maps 1:1 to a knowledge
# sourceType), so both drive the same resolveBlockScope → RetrieveScoped path;
# Part 2 proves the real live-data target (connector) works, not just documents.
#
# Live only, like the prompt suite:
#   - With an OpenRouter key in etc/config.local.yaml: real plan + synthesize +
#     embedding calls drive scoped retrieval and generation.
#   - No key (CI-safe): the suite SKIPS and exits 0.
#
# Assertions target scope MEMBERSHIP (which source's invented identifier appears
# — Zephyrite for solar, Borealis for wind), not exact wording. Manual
# walkthrough in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

cleanup() {
  for pid in "${WATCHER_PIDS[@]:-}"; do [[ -n "$pid" ]] && kill "$pid" 2>/dev/null; done
  stop_service
}

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the context-scope suite."
  info "Per-block context scoping can only be judged against real models; add a key"
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

WATCHER_PIDS=()
WATCHER_BIN="$(mktemp -u)"

trap cleanup EXIT
start_service

# start_watcher FOLDER TEXT — write TEXT into FOLDER, launch a connector watcher
# over it, and set LAST_WATCHER_URL to the watcher's http URL. Records the pid
# for cleanup. (Sets a global rather than echoing, so diagnostics never leak into
# a command-substitution capture.)
start_watcher() {
  local dir="$1" text="$2" log addr
  printf '%s\n' "$text" > "$dir/notes.txt"
  log="$(mktemp)"
  "$WATCHER_BIN" -folder "$dir" -addr 127.0.0.1:0 >"$log" 2>&1 &
  WATCHER_PIDS+=("$!")
  addr=""
  for _ in $(seq 1 25); do
    addr="$(grep -oE 'listening [0-9.]+:[0-9]+' "$log" | head -n1 | awk '{print $2}' || true)"
    [[ -n "$addr" ]] && break
    sleep 0.2
  done
  if [[ -n "$addr" ]]; then
    LAST_WATCHER_URL="http://$addr"
    pass "watcher listening on $addr"
  else
    LAST_WATCHER_URL=""
    fail "watcher did not start"; FAILURES=$((FAILURES + 1))
  fi
}

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

# expect_scoped_answer DOC BLOCK WANT AVOID — the resolved block should carry
# "status":"ok" and an answer naming WANT and never AVOID. One bounded retry
# covers the step's model-judgment surface: a live model occasionally declines
# perfectly good evidence or paraphrases instead of naming the identifier, and
# one such sample should not fail the suite — a systematic decline or paraphrase
# still does. The AVOID assertion gets no such grace: it is the scope-membership
# property itself, and it is asserted strictly on whichever answer is final.
expect_scoped_answer() {
  local doc="$1" block="$2" want="$3" avoid="$4"
  request GET "/documents/$doc"; expect_status 200
  if [[ "$LAST_BODY" != *'"status":"ok"'* || "$(answer_text)" != *"$want"* ]]; then
    info "model wobbled once (declined or paraphrased) — retrying the resolve"
    resolve_wait "$doc" "$block" refresh
    request GET "/documents/$doc"; expect_status 200
  fi
  expect_body '"status":"ok"'
  assert_answer_has "$want"
  assert_answer_lacks "$avoid"
}

# current_revision DOC — the document's current head revision, so a change can
# submit at the right expectedRevision after resolutions have bumped it.
current_revision() {
  request GET "/documents/$1" >/dev/null
  printf '%s' "$LAST_BODY" | jq -r '.revision'
}

# set_block_context DOC BLOCK JSON — submit a set_block_context op at the current
# revision (fetched fresh, since resolutions bump the revision between edits).
SBC_N=0
set_block_context() {
  local doc="$1" block="$2" ctx="$3" rev
  rev="$(current_revision "$doc")"
  SBC_N=$((SBC_N + 1))
  request POST "/documents/$doc/changes" \
    "{\"submissionId\":\"sbc-$SBC_N\",\"expectedRevision\":$rev,\"operations\":[{\"op\":\"set_block_context\",\"blockId\":\"$block\",\"blockContext\":$ctx}]}"
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

# The invented identifiers appear nowhere else, so the model can only name one if
# that source was actually in retrieval scope — the test is about scope
# membership, not the model's world knowledge.
SOLAR_TEXT="The Zephyrite reactor generates electricity from concentrated sunlight. Zephyrite is a solar technology."
WIND_TEXT="The Borealis turbine generates electricity from steady wind. Borealis is a wind technology."
# The instruction has to be unambiguous, because this suite asserts on scope
# membership and a wrong answer must mean "the wrong source was in scope" and
# nothing else.
#
# It used to read "Name the power-generation technology described in the sources,
# using the exact name the sources use for it." That admits two correct answers.
# The source says "Borealis is a wind technology", so "wind technology" IS a
# power-generation technology the source names, spelled exactly as the source
# spells it. A model answering that has obeyed the instruction; the suite scored
# it as a failure, and a real one — gpt-5.6-luna — was recorded as weaker on that
# basis. Asking for the PROPER NAME excludes the category without hinting at the
# answer.
INSTRUCTION="The sources describe one power-generation system and give it a proper name. Reply with that proper name only, spelled as the sources spell it. Answer only from the sources."

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Context Scope Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

( cd "$PROJECT_ROOT" && go build -o "$WATCHER_BIN" ./cmd/connector-watcher )

# ---------------------------------------------------------------------------
info "Part 1: variables bound to two indexed DOCUMENTS (kind-agnostic scope)"
# ---------------------------------------------------------------------------
echo
info "Create two source documents with distinct identifiers, and index both"
request POST /documents "{\"name\":\"Solar\",\"rows\":[{\"blocks\":[{\"kind\":\"text\",\"atoms\":[{\"kind\":\"text\",\"text\":\"$SOLAR_TEXT\"}]}]}]}"
expect_status 201
SOLAR_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$SOLAR_ID"; expect_status 201; track_usage
request POST /documents "{\"name\":\"Wind\",\"rows\":[{\"blocks\":[{\"kind\":\"text\",\"atoms\":[{\"kind\":\"text\",\"text\":\"$WIND_TEXT\"}]}]}]}"
expect_status 201
WIND_ID="$(json_field id)"
request POST "/dev/knowledge/documents/$WIND_ID"; expect_status 201; track_usage

echo
info "Create the report: declare two variables bound to the two documents, plus a prompt block"
request POST /documents "{\"name\":\"Doc Report\",\"rows\":[{\"blocks\":[{\"id\":\"pb\",\"kind\":\"prompt\",\"data\":{\"instruction\":\"$INSTRUCTION\"}}]}]}"
expect_status 201
DOC_REPORT="$(json_field id)"
request POST "/documents/$DOC_REPORT/changes" '{"submissionId":"tmpl","expectedRevision":0,"operations":[{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"solar"},{"name":"wind"}]}}]}'
expect_status 201
request POST "/documents/$DOC_REPORT/changes" "{\"submissionId\":\"scv-solar\",\"expectedRevision\":1,\"operations\":[{\"op\":\"set_context_variable\",\"contextVarName\":\"solar\",\"boundResource\":{\"kind\":\"document\",\"id\":\"$SOLAR_ID\"}}]}"
expect_status 201
request POST "/documents/$DOC_REPORT/changes" "{\"submissionId\":\"scv-wind\",\"expectedRevision\":2,\"operations\":[{\"op\":\"set_context_variable\",\"contextVarName\":\"wind\",\"boundResource\":{\"kind\":\"document\",\"id\":\"$WIND_ID\"}}]}"
expect_status 201

echo
info "Scope to solar → Zephyrite, not Borealis"
set_block_context "$DOC_REPORT" pb '{"include":["solar"]}'
resolve_wait "$DOC_REPORT" pb reload
expect_scoped_answer "$DOC_REPORT" pb Zephyrite Borealis; track_usage

echo
info "Swap to wind → the op clears ResolvedAt, refresh flips to Borealis, not Zephyrite"
set_block_context "$DOC_REPORT" pb '{"include":["wind"]}'
request GET "/documents/$DOC_REPORT"; expect_status 200
RESOLVED_AT="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].data.resolvedAt // "none"')"
# A cleared time.Time is the zero value, which serializes as 0001-01-01... (not
# omitted), so "cleared" means absent OR the zero time.
[[ "$RESOLVED_AT" == "none" || "$RESOLVED_AT" == 0001-* ]] && pass "set_block_context cleared ResolvedAt" \
  || { fail "ResolvedAt not cleared: $RESOLVED_AT"; FAILURES=$((FAILURES + 1)); }
resolve_wait "$DOC_REPORT" pb refresh
expect_scoped_answer "$DOC_REPORT" pb Borealis Zephyrite; track_usage

echo
info "Include both, exclude wind → Zephyrite, never Borealis"
set_block_context "$DOC_REPORT" pb '{"include":["solar","wind"],"exclude":["wind"]}'
resolve_wait "$DOC_REPORT" pb refresh
expect_scoped_answer "$DOC_REPORT" pb Zephyrite Borealis; track_usage

# ---------------------------------------------------------------------------
info "Part 2: variables bound to two live CONNECTOR resources (the real target)"
# ---------------------------------------------------------------------------
echo
info "Start two watchers, create + sync two connectors from them"
start_watcher "$(mktemp -d)" "$SOLAR_TEXT"; SOLAR_URL="$LAST_WATCHER_URL"
start_watcher "$(mktemp -d)" "$WIND_TEXT"; WIND_URL="$LAST_WATCHER_URL"
request POST /connectors '{"name":"Solar drive","subkind":"local-folder"}'; expect_status 201
SOLAR_CID="$(json_field id)"
request PUT "/connectors/$SOLAR_CID/config" "{\"path\":\"$SOLAR_URL\"}"; expect_status 200
request POST "/connectors/$SOLAR_CID/sync"; expect_status 200; track_usage
request POST /connectors '{"name":"Wind drive","subkind":"local-folder"}'; expect_status 201
WIND_CID="$(json_field id)"
request PUT "/connectors/$WIND_CID/config" "{\"path\":\"$WIND_URL\"}"; expect_status 200
request POST "/connectors/$WIND_CID/sync"; expect_status 200; track_usage

echo
info "Create a report whose variables bind to the two CONNECTORS"
request POST /documents "{\"name\":\"Connector Report\",\"rows\":[{\"blocks\":[{\"id\":\"pb\",\"kind\":\"prompt\",\"data\":{\"instruction\":\"$INSTRUCTION\"}}]}]}"
expect_status 201
CONN_REPORT="$(json_field id)"
request POST "/documents/$CONN_REPORT/changes" '{"submissionId":"tmpl","expectedRevision":0,"operations":[{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"solar"},{"name":"wind"}]}}]}'
expect_status 201
request POST "/documents/$CONN_REPORT/changes" "{\"submissionId\":\"scv-solar\",\"expectedRevision\":1,\"operations\":[{\"op\":\"set_context_variable\",\"contextVarName\":\"solar\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$SOLAR_CID\"}}]}"
expect_status 201
request POST "/documents/$CONN_REPORT/changes" "{\"submissionId\":\"scv-wind\",\"expectedRevision\":2,\"operations\":[{\"op\":\"set_context_variable\",\"contextVarName\":\"wind\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$WIND_CID\"}}]}"
expect_status 201

echo
info "Scope to the SOLAR connector → Zephyrite, not Borealis"
set_block_context "$CONN_REPORT" pb '{"include":["solar"]}'
resolve_wait "$CONN_REPORT" pb reload
expect_scoped_answer "$CONN_REPORT" pb Zephyrite Borealis; track_usage

echo
info "Switch the connector scope to WIND → refresh flips to Borealis, not Zephyrite"
set_block_context "$CONN_REPORT" pb '{"include":["wind"]}'
resolve_wait "$CONN_REPORT" pb refresh
expect_scoped_answer "$CONN_REPORT" pb Borealis Zephyrite; track_usage

usage_summary 0.20

finish
