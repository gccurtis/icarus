#!/usr/bin/env bash
# Unified Resource lifecycle, Activity, and aggregate Project timestamp.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Dev\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Resource Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

info "The catalog is empty and honestly reports the kinds that can be created"
request GET /resources
expect_status 200
expect_body '"resources":[]'
# Ω-002 added File as the third production family; availableKinds is sorted.
expect_body '"availableKinds":["connector","document","file"]'

info "Create a canonical Document through Resource"
request POST /resources '{"kind":"document","name":"Plan"}'
expect_status 201
expect_body '"kind":"document"'
RESOURCE_ID="$(json_field id)"
request GET "/documents/$RESOURCE_ID"
expect_status 200
expect_body '"name":"Plan"'
request GET "/resources/document/$RESOURCE_ID"
expect_status 200
expect_body '"name":"Plan"'

info "Rename it and observe canonical metadata plus Activity"
request PATCH "/resources/document/$RESOURCE_ID" '{"name":"Launch Plan"}'
expect_status 200
request GET /resources
expect_status 200
expect_body '"name":"Launch Plan"'
request GET "/resources/document/$RESOURCE_ID"
expect_status 200
expect_body '"name":"Launch Plan"'
request GET '/activity?limit=10'
expect_status 200
expect_body '"action":"renamed"'
expect_body '"name":"Dev"'

info "Activity can be filtered to one resource with targetID"
request GET "/activity?targetID=$RESOURCE_ID&limit=10"
expect_status 200
expect_body '"action":"renamed"'
FOREIGN="$(printf '%s' "$LAST_BODY" | jq --arg id "$RESOURCE_ID" '[.events[] | select(.target.id != $id)] | length')"
[[ "$FOREIGN" == "0" ]] && pass "targetID filter returns only this resource's events" || { fail "leaked $FOREIGN foreign events"; FAILURES=$((FAILURES + 1)); }
request GET '/activity?targetID=does-not-exist&limit=10'
expect_status 200
EMPTY="$(printf '%s' "$LAST_BODY" | jq '.events | length')"
[[ "$EMPTY" == "0" ]] && pass "unknown targetID returns no events" || { fail "expected 0 events, got $EMPTY"; FAILURES=$((FAILURES + 1)); }

echo
info "Pin the resource, then unpin it (catalog attribute)"
request PATCH "/resources/document/$RESOURCE_ID/attributes" '{"pinned":true}'
expect_status 200
expect_body '"pinned":true'
request GET "/resources/document/$RESOURCE_ID"
expect_status 200
expect_body '"pinned":true'
request GET /resources
expect_status 200
expect_body '"pinned":true'
request PATCH "/resources/document/$RESOURCE_ID/attributes" '{"pinned":false}'
expect_status 200
expect_body '"pinned":false'
info "Pinning a resource that does not exist is a 404"
request PATCH "/resources/document/does-not-exist/attributes" '{"pinned":true}'
expect_status 404

info "Unavailable and unknown kinds fail explicitly"
request POST /resources '{"kind":"slides","name":"Deck"}'
expect_status 409
request POST /resources '{"kind":"unknown","name":"Nope"}'
expect_status 400

info "Delete removes the resource from the catalog (soft delete) and records Activity"
request DELETE "/resources/document/$RESOURCE_ID"
expect_status 200
request GET /resources
expect_status 200
expect_body '"resources":[]'
request GET '/activity?limit=10'
expect_status 200
expect_body '"action":"trashed"'
expect_body '"name":"Launch Plan"'

finish
