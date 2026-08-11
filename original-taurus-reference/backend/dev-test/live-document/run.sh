#!/usr/bin/env bash
# End-to-end live-document demo (Slice I): the whole program in one terminal run.
#
# A document that is mostly a prompt block, fed by connector-backed context
# variables, that:
#   - resolves grounded in exactly its scoped source (Slices A–E),
#   - flips its output when the context variable is swapped (criterion 4),
#   - refreshes ON ITS OWN when the underlying folder changes, attributed to the
#     system actor and visible in Activity (Slices F–G, criterion 3),
#   - scopes exactly, including exclude (criterion 5),
#   - and is restructured by the AI quarterback into live prompt blocks it
#     authors and resolves (Slice H, criterion 6).
#
# Model-backed, so it SKIPS (exit 0) without an OpenRouter key, and prints its
# token cost when it runs. Assertions target scope MEMBERSHIP (which source's
# fact appears), not model wording. Manual walkthrough in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

cleanup() {
  for pid in "${WATCHER_PIDS[@]:-}"; do [[ -n "$pid" ]] && kill "$pid" 2>/dev/null; done
  stop_service
}

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the live-document demo."
  info "The demo is model-backed (prompt resolution + an agent action); add a key"
  info "to etc/config.local.yaml (api_key: \"...\") to run the full end-to-end proof."
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
( cd "$PROJECT_ROOT" && go build -o "$WATCHER_BIN" ./cmd/connector-watcher )

# start_watcher DIR — launch a connector watcher over DIR, set LAST_WATCHER_URL.
start_watcher() {
  local dir="$1" log addr
  log="$(mktemp)"
  "$WATCHER_BIN" -folder "$dir" -addr 127.0.0.1:0 >"$log" 2>&1 &
  WATCHER_PIDS+=("$!")
  addr=""
  for _ in $(seq 1 50); do
    addr="$(grep -oE 'listening [0-9.]+:[0-9]+' "$log" | head -n1 | awk '{print $2}' || true)"
    [[ -n "$addr" ]] && break
    sleep 0.2
  done
  [[ -n "$addr" ]] && { LAST_WATCHER_URL="http://$addr"; pass "watcher on $addr"; } \
    || { LAST_WATCHER_URL=""; fail "watcher did not start"; FAILURES=$((FAILURES + 1)); }
}

resolve_wait() {
  local doc="$1" block="$2" mode="$3" job i
  request POST "/documents/$doc/blocks/$block/resolve" "{\"mode\":\"$mode\"}"
  expect_status 202
  job="$(json_field jobId)"
  for i in $(seq 1 60); do
    request GET "/dev/jobs/$job"
    [[ "$LAST_BODY" == *'"status":"done"'* ]] && return 0
    [[ "$LAST_BODY" == *'"status":"failed"'* ]] && { fail "resolve failed: $LAST_BODY"; FAILURES=$((FAILURES + 1)); return 1; }
    sleep 0.5
  done
  fail "resolve did not finish"; FAILURES=$((FAILURES + 1))
}

current_revision() { request GET "/documents/$1" >/dev/null; printf '%s' "$LAST_BODY" | jq -r '.revision'; }

SUBMIT_N=0
submit_op() { # DOC JSON_OP
  local doc="$1" op="$2" rev
  rev="$(current_revision "$doc")"
  SUBMIT_N=$((SUBMIT_N + 1))
  request POST "/documents/$doc/changes" "{\"submissionId\":\"op-$SUBMIT_N\",\"expectedRevision\":$rev,\"operations\":[$op]}"
  expect_status 201
}

block_text() { # DOC BLOCK  -> the block's resolved output text
  request GET "/documents/$1" >/dev/null
  printf '%s' "$LAST_BODY" | jq -r --arg b "$2" '[.base.rows[].blocks[] | select(.id==$b) | .data.lastOutput] | first // ""'
}

assert_has()  { if [[ "$1" == *"$2"* ]]; then pass "has: $2"; else fail "missing '$2' in: $1"; FAILURES=$((FAILURES + 1)); fi; }
assert_lacks(){ if [[ "$1" != *"$2"* ]]; then pass "omits: $2"; else fail "should omit '$2' in: $1"; FAILURES=$((FAILURES + 1)); fi; }

echo
info "Register, log in, create + select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Live Document"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

echo
info "Beat 1: two connectors with distinguishable content, each synced from a watcher (criteria 1–2)"
DIR_A="$(mktemp -d)"; DIR_B="$(mktemp -d)"
printf 'Q3 revenue was 4.2M, up 18%% on new enterprise accounts.\n' > "$DIR_A/notes.txt"
printf 'The company mascot is a purple otter named Waffles.\n'        > "$DIR_B/notes.txt"
start_watcher "$DIR_A"; URL_A="$LAST_WATCHER_URL"
start_watcher "$DIR_B"; URL_B="$LAST_WATCHER_URL"

request POST /connectors '{"name":"Finance","subkind":"local-folder"}'; expect_status 201; CONN_A="$(json_field id)"
request PUT "/connectors/$CONN_A/config" "{\"path\":\"$URL_A\"}"; expect_status 200
request POST "/connectors/$CONN_A/sync"; expect_status 200; track_usage
request POST /connectors '{"name":"Trivia","subkind":"local-folder"}'; expect_status 201; CONN_B="$(json_field id)"
request PUT "/connectors/$CONN_B/config" "{\"path\":\"$URL_B\"}"; expect_status 200
request POST "/connectors/$CONN_B/sync"; expect_status 200; track_usage

echo
info "Beat 2: a mostly-prompt-block document; variables bound to the connectors; block scoped to finance"
request POST /documents '{"name":"Board update","rows":[
  {"blocks":[{"kind":"text","subKind":"heading_1","atoms":[{"kind":"text","text":"Board update"}]}]},
  {"blocks":[{"id":"pb1","kind":"prompt","data":{"instruction":"State the single most notable fact from the sources, in one sentence."}}]}
]}'
expect_status 201
DOC_ID="$(json_field id)"
submit_op "$DOC_ID" '{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"finance"},{"name":"trivia"}]}}'
submit_op "$DOC_ID" "{\"op\":\"set_context_variable\",\"contextVarName\":\"finance\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$CONN_A\"}}"
submit_op "$DOC_ID" "{\"op\":\"set_context_variable\",\"contextVarName\":\"trivia\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$CONN_B\"}}"
submit_op "$DOC_ID" '{"op":"set_block_context","blockId":"pb1","blockContext":{"include":["finance"]}}'

echo
info "Beat 3: resolve grounded in the finance source only"
resolve_wait "$DOC_ID" pb1 reload
request GET "/documents/$DOC_ID" >/dev/null; track_usage
T="$(block_text "$DOC_ID" pb1)"
assert_has "$T" "4.2"
assert_lacks "$T" "otter"

echo
info "Beat 3b: swap the context variable finance → trivia; the output flips (criterion 4)"
submit_op "$DOC_ID" '{"op":"set_block_context","blockId":"pb1","blockContext":{"include":["trivia"]}}'
resolve_wait "$DOC_ID" pb1 refresh
request GET "/documents/$DOC_ID" >/dev/null; track_usage
T="$(block_text "$DOC_ID" pb1)"
assert_has "$T" "otter"
assert_lacks "$T" "4.2"

echo
info "Beat 4: external folder change → the document refreshes on its OWN, system-attributed (criterion 3)"
submit_op "$DOC_ID" '{"op":"set_block_context","blockId":"pb1","blockContext":{"include":["finance"]}}'
resolve_wait "$DOC_ID" pb1 refresh
# Change the finance source with NO document/API call; the detector re-syncs and
# the cascade re-resolves pb1.
printf 'Q3 revenue was 5.0M, up 42%% after the Meridian deal closed.\n' > "$DIR_A/notes.txt"
REFRESHED=""
for _ in $(seq 1 45); do
  sleep 1
  T="$(block_text "$DOC_ID" pb1)"
  if [[ "$T" == *"5.0"* || "$T" == *"Meridian"* ]]; then REFRESHED=1; break; fi
done
if [[ -n "$REFRESHED" ]]; then pass "block refreshed on its own after the external change"
else fail "block did not auto-refresh: $(block_text "$DOC_ID" pb1)"; FAILURES=$((FAILURES + 1)); fi
request GET "/documents/$DOC_ID" >/dev/null; track_usage
# The self-driven refresh is an accountable journal entry: a system-attributed edit.
request GET /activity; expect_status 200
if printf '%s' "$LAST_BODY" | jq -e --arg d "$DOC_ID" '.events[] | select((.target.id==$d) and (.actor.id=="system"))' >/dev/null; then
  pass "auto-refresh is logged in Activity, attributed to the system actor"
else
  fail "no system-attributed activity for the auto-refresh"; FAILURES=$((FAILURES + 1))
fi

echo
info "Beat 4b: exact scoping — include finance+trivia but EXCLUDE trivia (criterion 5)"
submit_op "$DOC_ID" '{"op":"set_block_context","blockId":"pb1","blockContext":{"include":["finance","trivia"],"exclude":["trivia"]}}'
resolve_wait "$DOC_ID" pb1 refresh
request GET "/documents/$DOC_ID" >/dev/null; track_usage
T="$(block_text "$DOC_ID" pb1)"
assert_has "$T" "Meridian"
assert_lacks "$T" "otter"

echo
info "Beat 5: the quarterback authors + resolves new prompt blocks with the finance context (criterion 6)"
PROMPTS_BEFORE="$(request GET "/documents/$DOC_ID" >/dev/null; printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.kind=="prompt")] | length')"
OBJ="Add two prompt blocks to document $DOC_ID, both using the finance context: an 'Overview' prompt whose instruction is a one-sentence revenue headline, and a 'Details' prompt whose instruction is the growth rate and its driver. Use document.prompt.create for each with include [\"finance\"], then document.prompt.resolve each. Do not edit any other block."
ACTION_BODY="$(jq -nc --arg o "$OBJ" '{objective:$o,persona:{personaId:"general"},context:[]}')"
# run_action POSTs the action and polls it to a terminal state (sets STATE).
run_action() {
  request POST /agent/actions "$ACTION_BODY"; expect_status 201
  TASK_ID="$(json_field id)"
  for _ in $(seq 1 240); do
    request GET "/agent/tasks/$TASK_ID"
    case "$(json_field state)" in completed|partially_completed|waiting|failed|canceled) break ;; esac
    sleep 0.5
  done
  STATE="$(json_field state)"
}
run_action
# One bounded retry with a fresh action. A failed action here means the model
# fumbled its final report twice in a row (the product already re-asks once,
# tool-free) — seen only inside provider-degraded windows. One such window
# should not fail the suite; a systematically failing action still does. The
# effect assertions below tolerate the extra authored blocks.
if [[ "$STATE" == "failed" ]]; then
  info "agent action failed once — retrying with a fresh action"
  run_action
fi
if [[ "$STATE" == "completed" ]]; then pass "agent action settled: $STATE"
else fail "agent action state = $STATE"; FAILURES=$((FAILURES + 1)); fi
track_usage

# Let the resolve jobs the agent enqueued finish.
sleep 4
request GET "/documents/$DOC_ID" >/dev/null; track_usage
PROMPTS="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.kind=="prompt")] | length')"
if [[ "$PROMPTS" -gt "$PROMPTS_BEFORE" ]]; then pass "quarterback authored new prompt blocks ($PROMPTS_BEFORE -> $PROMPTS)"
else fail "no new prompt blocks: $PROMPTS_BEFORE -> $PROMPTS"; FAILURES=$((FAILURES + 1)); fi
# Every prompt block carries the finance context (the ones the agent made, plus
# pb1 which already includes finance).
NON_FINANCE="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[] | select(.kind=="prompt") | select((.context.include // []) | index("finance") | not)] | length')"
if [[ "$NON_FINANCE" == "0" ]]; then pass "every prompt block uses the finance context"
else fail "$NON_FINANCE prompt block(s) missing the finance context"; FAILURES=$((FAILURES + 1)); fi

usage_summary 0.30

finish
