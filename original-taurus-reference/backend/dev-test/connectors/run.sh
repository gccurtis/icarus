#!/usr/bin/env bash
# Automated dev-test for the connector resource kind: create a local-folder
# connector, configure its provider endpoint, read it back, and confirm it joins
# the unified resource catalog and availableKinds (always runs, no model). The
# sync section (key-gated) runs the external connector-watcher, syncs its content
# into the lattice, and proves the detector re-syncs on an external change.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

cleanup() {
  [[ -n "${WATCHER_PID:-}" ]] && kill "$WATCHER_PID" 2>/dev/null
  stop_service
}

# The CRUD checks below always run. The sync checks feed the knowledge lattice
# (real embedding), so they need a provider key; without one they are skipped.
KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
trap cleanup EXIT
start_service

info "Register + login + create/select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Connectors"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a local-folder connector"
request POST /connectors '{"name":"Sales drive","subkind":"local-folder"}'; expect_status 201
CID="$(json_field id)"
[[ "$(json_field subkind)" == "local-folder" ]] && pass "subkind set" || { fail "subkind wrong"; FAILURES=$((FAILURES + 1)); }

info "An unsupported subkind is rejected"
request POST /connectors '{"name":"nope","subkind":"dropbox"}'; expect_status 400

info "Configure its provider endpoint (non-empty required)"
request PUT "/connectors/$CID/config" '{"path":"   "}'; expect_status 400
request PUT "/connectors/$CID/config" '{"path":"http://127.0.0.1:9099"}'; expect_status 200
[[ "$(json_field path)" == "http://127.0.0.1:9099" ]] && pass "endpoint set" || { fail "endpoint wrong"; FAILURES=$((FAILURES + 1)); }

info "Read it back"
request GET "/connectors/$CID"; expect_status 200
[[ "$(json_field path)" == "http://127.0.0.1:9099" && "$(json_field subkind)" == "local-folder" ]] \
  && pass "connector round-trips" || { fail "get wrong"; FAILURES=$((FAILURES + 1)); }

info "It appears in the catalog and availableKinds"
request GET /resources; expect_status 200
if printf '%s' "$LAST_BODY" | jq -e '.availableKinds | index("connector")' >/dev/null; then
  pass "connector is available"
else
  fail "availableKinds missing connector"; FAILURES=$((FAILURES + 1))
fi
if printf '%s' "$LAST_BODY" | jq -e --arg id "$CID" '.resources[] | select(.id==$id and .kind=="connector")' >/dev/null; then
  pass "connector listed in catalog"
else
  fail "connector not in catalog"; FAILURES=$((FAILURES + 1))
fi

info "Rename through the generic resource surface; delete through it too"
request PATCH "/resources/connector/$CID" '{"name":"Finance drive"}'; expect_status 200
request DELETE "/resources/connector/$CID"; expect_status 200
request GET "/connectors/$CID"; expect_status 404

if [[ -n "$KEY" ]]; then
  info "Start the external connector-watcher over a temp folder"
  SYNC_DIR="$(mktemp -d)"
  printf 'Photosynthesis converts sunlight into chemical energy in green plants.\n' > "$SYNC_DIR/notes.txt"
  WATCHER_BIN="$(mktemp -u)"
  ( cd "$PROJECT_ROOT" && go build -o "$WATCHER_BIN" ./cmd/connector-watcher )
  WATCHER_LOG="$(mktemp)"
  "$WATCHER_BIN" -folder "$SYNC_DIR" -addr 127.0.0.1:0 >"$WATCHER_LOG" 2>&1 &
  WATCHER_PID=$!
  WADDR=""
  for _ in $(seq 1 25); do
    WADDR="$(grep -oE 'listening [0-9.]+:[0-9]+' "$WATCHER_LOG" | head -n1 | awk '{print $2}' || true)"
    [[ -n "$WADDR" ]] && break
    sleep 0.2
  done
  [[ -n "$WADDR" ]] && pass "watcher listening on $WADDR" || { fail "watcher did not start"; FAILURES=$((FAILURES + 1)); }
  WATCHER_URL="http://$WADDR"

  info "Sync: Omega pulls content from the watcher into the lattice"
  request POST /connectors '{"name":"Docs","subkind":"local-folder"}'; expect_status 201
  SID="$(json_field id)"
  request PUT "/connectors/$SID/config" "{\"path\":\"$WATCHER_URL\"}"; expect_status 200
  # The manual sync always re-syncs (changed=true); the background detector may
  # have already synced once, so we assert on `changed`, not an exact seq. The
  # sync response now carries embedding usage, so track_usage counts it.
  request POST "/connectors/$SID/sync"; expect_status 200; track_usage
  [[ "$(printf '%s' "$LAST_BODY" | jq -r '.changed')" == "true" ]] \
    && pass "manual sync fed the lattice" || { fail "sync did not report a change"; FAILURES=$((FAILURES + 1)); }
  request GET "/connectors/$SID" >/dev/null
  BEFORE="$(printf '%s' "$LAST_BODY" | jq -r '.syncSeq // 0')"

  info "Retrieval finds the synced connector content"
  request POST /dev/knowledge/retrieve '{"query":"how do plants make energy","topK":3}'; expect_status 200; track_usage
  # A connector's lattice sources are keyed per file — connectorID, a unit
  # separator, then the file's relative path (see FileSourceID) — so match the
  # connector by prefix rather than expecting the bare connector id.
  if printf '%s' "$LAST_BODY" | jq -e --arg id "$SID" '.regions[] | select(.sourceType=="connector" and (.sourceId | startswith($id)))' >/dev/null; then
    pass "connector content retrievable from the lattice"
  else
    fail "connector content not found in retrieval"; FAILURES=$((FAILURES + 1))
  fi

  info "Change the folder; Omega's detector polls the watcher and re-syncs on its own"
  printf 'Cellular respiration releases energy from glucose inside mitochondria.\n' > "$SYNC_DIR/notes.txt"
  RESYNCED=""
  for _ in $(seq 1 15); do
    sleep 1
    request GET "/connectors/$SID" >/dev/null
    if [[ "$(printf '%s' "$LAST_BODY" | jq -r '.syncSeq // 0')" -gt "$BEFORE" ]]; then RESYNCED=1; break; fi
  done
  [[ -n "$RESYNCED" ]] && pass "detector auto re-synced after external change (syncSeq advanced)" \
    || { fail "auto re-sync did not happen within the wait"; FAILURES=$((FAILURES + 1)); }

  usage_summary
else
  info "No provider key — skipping the sync/auto-resync checks (CRUD verified above)."
fi

finish
