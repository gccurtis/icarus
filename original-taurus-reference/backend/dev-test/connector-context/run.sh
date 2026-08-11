#!/usr/bin/env bash
# Live dev-test: connector-as-context end to end (record 0107).
#
# Proves the whole "connectors as context" slice against a REAL model, in one
# run:
#   1. A connector watching a folder with two files (distinct facts) is synced
#      into the lattice — one lattice source PER FILE (record 0107 Task 4).
#   2. A context that includes the bare connector resolves — BEFORE any model
#      call — to the two FILE origins, not the bare connector id (Task 5).
#   3. A prompt document binds a variable to that CONTEXT and a second variable
#      directly to one file's composite id (`<connectorID>/<fileID>`),
#      excluding it at the block level — a real model answers grounded in the
#      included file's fact and never the excluded file's (leaf exclusion of
#      one file inside a connector, Task 5's exact-match branch).
#   4. The included file is edited on disk with NO document/API call; the
#      background detector re-syncs the connector, and the prompt block
#      AUTO-refreshes to the new fact through the context (Task 6's deep
#      cascade) — without this suite ever re-submitting the block itself.
#
# Live only: with an OpenRouter key in etc/config.local.yaml, real embedding +
# reasoning calls drive retrieval and generation; without one, the suite SKIPS
# (exit 0) so CI stays green without secrets. Token/cost is always printed.
#
# Modeled on dev-test/live-document/run.sh (watcher + connector harness) and
# dev-test/context-scope/run.sh & dev-test/context-binding/run.sh (context /
# scoped-retrieval assertions, submissionId/revision discipline).

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

cleanup() {
  [[ -n "${WATCHER_PID:-}" ]] && kill "$WATCHER_PID" 2>/dev/null
  stop_service
}

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the connector-context suite."
  info "Connector-as-context retrieval quality can only be judged against real models;"
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

# The connector file-source separator (core/capability/connector/connector.go's
# FileSeparator). It was a raw control byte until a source id proved unable to
# survive a round trip through a model as part of a citation; both halves it
# joins are hex ids, so a slash separates them unambiguously.
SEP='/'

WATCHER_BIN="$(mktemp -u)"

trap cleanup EXIT
start_service
( cd "$PROJECT_ROOT" && go build -o "$WATCHER_BIN" ./cmd/connector-watcher )

# start_watcher DIR — launch a connector watcher over DIR, set LAST_WATCHER_URL.
start_watcher() {
  local dir="$1" log addr
  log="$(mktemp)"
  "$WATCHER_BIN" -folder "$dir" -addr 127.0.0.1:0 >"$log" 2>&1 &
  WATCHER_PID="$!"
  addr=""
  for _ in $(seq 1 50); do
    addr="$(grep -oE 'listening [0-9.]+:[0-9]+' "$log" | head -n1 | awk '{print $2}' || true)"
    [[ -n "$addr" ]] && break
    sleep 0.2
  done
  [[ -n "$addr" ]] && { LAST_WATCHER_URL="http://$addr"; pass "watcher on $addr"; } \
    || { LAST_WATCHER_URL=""; fail "watcher did not start"; FAILURES=$((FAILURES + 1)); }
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
    [[ "$LAST_BODY" == *'"status":"failed"'* ]] && { fail "resolve failed: $LAST_BODY"; FAILURES=$((FAILURES + 1)); return 1; }
    sleep 0.5
  done
  fail "resolve did not finish"; FAILURES=$((FAILURES + 1))
}

# current_revision DOC — the document's current head revision, fetched fresh.
# `>/dev/null` discards request's own stdout log line so it never corrupts the
# captured value via command substitution.
current_revision() { request GET "/documents/$1" >/dev/null; printf '%s' "$LAST_BODY" | jq -r '.revision'; }

SUBMIT_N=0
submit_op() { # DOC JSON_OP — submit one op at the document's current revision.
  local doc="$1" op="$2" rev
  rev="$(current_revision "$doc")"
  SUBMIT_N=$((SUBMIT_N + 1))
  request POST "/documents/$doc/changes" "{\"submissionId\":\"op-$SUBMIT_N\",\"expectedRevision\":$rev,\"operations\":[$op]}"
  expect_status 201
}

block_text() { # DOC BLOCK -> the block's resolved output text
  request GET "/documents/$1" >/dev/null
  printf '%s' "$LAST_BODY" | jq -r --arg b "$2" '[.base.rows[].blocks[] | select(.id==$b) | .data.lastOutput] | first // ""'
}

assert_has()  { if [[ "$1" == *"$2"* ]]; then pass "has: $2"; else fail "missing '$2' in: $1"; FAILURES=$((FAILURES + 1)); fi; }
assert_lacks(){ if [[ "$1" != *"$2"* ]]; then pass "omits: $2"; else fail "should omit '$2' in: $1"; FAILURES=$((FAILURES + 1)); fi; }

# Invented, mutually distinct facts so the model can only ground an answer in
# 512/777/1400 if the matching FILE was actually in retrieval scope.
TOWER_TEXT="The Meridian tower is 512 meters tall."
TOWER_TEXT_UPDATED="The Meridian tower is 777 meters tall."
BRIDGE_TEXT="The Solace bridge spans 1400 meters."
INSTRUCTION="How tall is the Meridian tower? Answer only from the sources, with the number of meters."

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Connector Context Project"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

echo
info "Beat 1: a folder with TWO files carrying distinct facts, watched, synced by a connector"
DIR="$(mktemp -d)"
printf '%s\n' "$TOWER_TEXT" > "$DIR/tower.md"
printf '%s\n' "$BRIDGE_TEXT" > "$DIR/bridge.md"
start_watcher "$DIR"

request POST /connectors '{"name":"Facts","subkind":"local-folder"}'; expect_status 201
CONN_ID="$(json_field id)"
info "connector id = $CONN_ID"
request PUT "/connectors/$CONN_ID/config" "{\"path\":\"$LAST_WATCHER_URL\"}"; expect_status 200
request POST "/connectors/$CONN_ID/sync"; expect_status 200; track_usage

echo
info "Beat 2: a context that includes the bare connector resolves to the two FILE origins, before any model call"
request POST /contexts "$(jq -nc --arg cid "$CONN_ID" '{name:"Facts context", includes:[{kind:"connector", id:$cid}]}')"
expect_status 201
CONTEXT_ID="$(json_field id)"
info "context id = $CONTEXT_ID"

request GET "/contexts/$CONTEXT_ID/resolved"
expect_status 200
ORIGIN_COUNT="$(printf '%s' "$LAST_BODY" | jq '.origins | length')"
[[ "$ORIGIN_COUNT" == "2" ]] && pass "resolved to exactly 2 file origins" \
  || { fail "expected 2 origins, got $ORIGIN_COUNT: $LAST_BODY"; FAILURES=$((FAILURES + 1)); }
PREFIXED_COUNT="$(printf '%s' "$LAST_BODY" | jq --arg p "$CONN_ID$SEP" '[.origins[] | select(.kind=="connector" and (.id | startswith($p)))] | length')"
[[ "$PREFIXED_COUNT" == "2" ]] && pass "both origins are connector-file ids (connectorID + / + fileID)" \
  || { fail "expected 2 connector-file-prefixed origins, got $PREFIXED_COUNT: $LAST_BODY"; FAILURES=$((FAILURES + 1)); }
BARE_COUNT="$(printf '%s' "$LAST_BODY" | jq --arg id "$CONN_ID" '[.origins[] | select(.id == $id)] | length')"
[[ "$BARE_COUNT" == "0" ]] && pass "the bare connector id never appears as an origin" \
  || { fail "bare connector id leaked into origins: $LAST_BODY"; FAILURES=$((FAILURES + 1)); }

echo
info "Beat 3: a prompt document — variable bound to the CONTEXT, a second bound to bridge.md's leaf id, excluded at the block"
request POST /documents "$(jq -nc --arg instr "$INSTRUCTION" '{name:"Tower Report", rows:[{blocks:[{id:"pb", kind:"prompt", data:{instruction:$instr}}]}]}')"
expect_status 201
DOC_ID="$(json_field id)"
info "document id = $DOC_ID"
submit_op "$DOC_ID" '{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"src"},{"name":"noBridge"}]}}'
submit_op "$DOC_ID" "{\"op\":\"set_context_variable\",\"contextVarName\":\"src\",\"boundResource\":{\"kind\":\"context\",\"id\":\"$CONTEXT_ID\"}}"
# bridge.md's leaf id is MINTED at sync time, not composed from its path, so it
# is looked up by the key the provider knows it by. This is exactly what a client
# offering "exclude this one file from this block" has to do, and it asks the
# CONNECTOR — the capability that minted the ids and knows what its provider
# calls a member — rather than the lattice.
request GET "/connectors/$CONN_ID/files"
expect_status 200
LISTED="$(printf '%s' "$LAST_BODY" | jq -r '[.files[].key] | join(",")')"
[[ "$LISTED" == "bridge.md,tower.md" ]] && pass "the connector lists its files by provider key: $LISTED" \
  || { fail "expected bridge.md,tower.md; got '$LISTED'"; FAILURES=$((FAILURES + 1)); }
BRIDGE_SID="$(printf '%s' "$LAST_BODY" | jq -r '[.files[] | select(.key=="bridge.md") | .sourceId] | first // ""')"
if [[ -n "$BRIDGE_SID" ]]; then
  pass "resolved bridge.md to its minted lattice id: $BRIDGE_SID"
else
  fail "could not resolve bridge.md to a lattice id"; FAILURES=$((FAILURES + 1))
fi
NOBRIDGE_OP="$(jq -nc --arg sid "$BRIDGE_SID" '{op:"set_context_variable", contextVarName:"noBridge", boundResource:{kind:"connector", id:$sid}}')"
submit_op "$DOC_ID" "$NOBRIDGE_OP"
submit_op "$DOC_ID" '{"op":"set_block_context","blockId":"pb","blockContext":{"include":["src"],"exclude":["noBridge"]}}'

echo
info "Beat 4: resolve — grounded in tower.md (512), never bridge.md (1400), leaf-excluded inside the connector"
resolve_wait "$DOC_ID" pb reload
request GET "/documents/$DOC_ID" >/dev/null; track_usage
T="$(block_text "$DOC_ID" pb)"
assert_has "$T" "512"
assert_lacks "$T" "1400"

echo
info "Beat 5: deep-cascade proof — edit tower.md on disk (no API call); the detector re-syncs and the block AUTO-refreshes to 777, through the context, without re-submitting the block"
printf '%s\n' "$TOWER_TEXT_UPDATED" > "$DIR/tower.md"
REFRESHED=""
for _ in $(seq 1 45); do
  sleep 1
  T="$(block_text "$DOC_ID" pb)"
  [[ "$T" == *"777"* ]] && { REFRESHED=1; break; }
done
if [[ -n "$REFRESHED" ]]; then pass "block auto-refreshed to 777 after the external connector-file change"
else fail "block did not auto-refresh: $(block_text "$DOC_ID" pb)"; FAILURES=$((FAILURES + 1)); fi
assert_lacks "$T" "1400"
request GET "/documents/$DOC_ID" >/dev/null; track_usage

usage_summary 0.20

finish
