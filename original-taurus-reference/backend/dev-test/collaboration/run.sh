#!/usr/bin/env bash
# Automated dev-test for document collaboration + presence: the collaboration
# projection reports a unified last-edit (from the activity feed, spanning content
# changes and resource renames) and the users currently viewing a document; the
# presence heartbeat (PUT) and clear (DELETE) drive the open-user set. No model is
# involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create + select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Collab Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document, then rename it (a resource rename)"
request POST /documents '{"name":"Draft","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hi"}]}]}]}'
expect_status 201
DOC_ID="$(json_field id)"
request PATCH "/documents/$DOC_ID" '{"name":"Launch Plan"}'; expect_status 200

info "Collaboration projection reports the rename as the last edit; no viewers yet"
request GET "/documents/$DOC_ID/collaboration"; expect_status 200
SOURCE="$(printf '%s' "$LAST_BODY" | jq -r '.lastEdit.source')"
ACTOR="$(printf '%s' "$LAST_BODY" | jq -r '.lastEdit.actor.name')"
OPEN0="$(printf '%s' "$LAST_BODY" | jq '.openUsers | length')"
if [[ "$SOURCE" == "resource_rename" && "$ACTOR" == "Ada" && "$OPEN0" == "0" ]]; then
  pass "lastEdit = rename by Ada; no open users"
else
  fail "collaboration wrong: source=$SOURCE actor=$ACTOR open=$OPEN0"; FAILURES=$((FAILURES + 1))
fi

info "Heartbeat presence, then the caller appears in openUsers"
request PUT "/documents/$DOC_ID/presence" '{"state":"open"}'; expect_status 204
request GET "/documents/$DOC_ID/collaboration"; expect_status 200
OPEN1="$(printf '%s' "$LAST_BODY" | jq '.openUsers | length')"
KIND="$(printf '%s' "$LAST_BODY" | jq -r '.openUsers[0].identity.kind')"
ACCESS="$(printf '%s' "$LAST_BODY" | jq -r '.openUsers[0].access')"
if [[ "$OPEN1" == "1" && "$KIND" == "user" && "$ACCESS" == "owner" ]]; then
  pass "presence heartbeat put the owner in openUsers (access=owner)"
else
  fail "presence wrong: open=$OPEN1 kind=$KIND access=$ACCESS"; FAILURES=$((FAILURES + 1))
fi

info "Clearing presence removes the caller (idempotent)"
request DELETE "/documents/$DOC_ID/presence"; expect_status 204
request DELETE "/documents/$DOC_ID/presence"; expect_status 204   # idempotent
request GET "/documents/$DOC_ID/collaboration"; expect_status 200
OPEN2="$(printf '%s' "$LAST_BODY" | jq '.openUsers | length')"
[[ "$OPEN2" == "0" ]] && pass "presence cleared (no open users)" || { fail "expected 0 open, got $OPEN2"; FAILURES=$((FAILURES + 1)); }

info "Collaboration on an unknown document is a 404"
request GET "/documents/does-not-exist/collaboration"; expect_status 404
request PUT "/documents/does-not-exist/presence" '{"state":"open"}'; expect_status 404

finish
