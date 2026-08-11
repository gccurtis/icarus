#!/usr/bin/env bash
# Automated dev-test for per-resource access scoping: within a Project, the
# document owner narrows a document to specific people; a fellow Project member
# who is not included loses it from the resource catalog AND cannot open it
# directly by URL, while the owner keeps full access. Re-opening the scope to the
# whole Project restores the member's access, and a non-owner can never change the
# scope. All narrowing stays within Project members (the Project gate is absolute).
# No model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

OWNER_EMAIL="owner@taurus.local"
MEMBER_EMAIL="member@taurus.local"
PW="devpassword"
# login swaps the active session to a user and re-selects the shared Project when
# one exists — a fresh login starts with no Project selected.
login() {
  request POST /auth/login "{\"email\":\"$1\",\"password\":\"$PW\"}"; expect_status 200
  if [[ -n "${PROJECT_ID:-}" ]]; then
    request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
  fi
}

info "Register an owner and a member; capture the member's id"
request POST /auth/register "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$PW\"}"; expect_status 201
request POST /auth/register "{\"email\":\"$MEMBER_EMAIL\",\"password\":\"$PW\"}"; expect_status 201
login "$MEMBER_EMAIL"; request GET /auth/me; expect_status 200; MEMBER_ID="$(json_field id)"
login "$OWNER_EMAIL"; request GET /auth/me; expect_status 200; OWNER_ID="$(json_field id)"

info "Owner creates a Project, adds the member (edit), and creates a document"
request POST /projects '{"name":"Access Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
request POST "/projects/$PROJECT_ID/members" "{\"email\":\"$MEMBER_EMAIL\",\"role\":\"edit\"}"; expect_status 201
request POST /documents '{"name":"Owner Brief","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"Secret"}]}]}]}'
expect_status 201
DOC_ID="$(json_field id)"
request POST "/documents/$DOC_ID/comments" '{"body":"owner note","anchor":{"rowId":"r1","blockId":"b1","atomId":"a1","start":0,"end":6}}'
expect_status 201
COMMENT_ID="$(json_field id)"

info "Before any restriction, the member sees the doc in the catalog and can open it"
login "$MEMBER_EMAIL"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
request GET /resources; expect_status 200
SEES="$(printf '%s' "$LAST_BODY" | jq --arg id "$DOC_ID" '[.resources[] | select(.id==$id)] | length')"
request GET "/documents/$DOC_ID"; expect_status 200
[[ "$SEES" == "1" ]] && pass "member sees the doc before restriction" || { fail "member should see doc (n=$SEES)"; FAILURES=$((FAILURES + 1)); }

info "A non-owner cannot change the access scope (403)"
request PATCH "/resources/document/$DOC_ID/access" "{\"access\":{\"projectWide\":false,\"userIds\":[\"$MEMBER_ID\"]}}"; expect_status 403

info "Owner restricts the doc to just themselves (private)"
login "$OWNER_EMAIL"
request PATCH "/resources/document/$DOC_ID/access" '{"access":{"projectWide":false}}'; expect_status 200
PW_FLAG="$(printf '%s' "$LAST_BODY" | jq -r '.access.projectWide')"
[[ "$PW_FLAG" == "false" ]] && pass "scope now private (projectWide=false)" || { fail "scope not applied: $PW_FLAG"; FAILURES=$((FAILURES + 1)); }

info "The member now loses the doc from the catalog and is denied direct access (403)"
login "$MEMBER_EMAIL"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
request GET /resources; expect_status 200
GONE="$(printf '%s' "$LAST_BODY" | jq --arg id "$DOC_ID" '[.resources[] | select(.id==$id)] | length')"
[[ "$GONE" == "0" ]] && pass "restricted doc hidden from member's catalog" || { fail "doc still visible (n=$GONE)"; FAILURES=$((FAILURES + 1)); }
request GET "/documents/$DOC_ID"; expect_status 403

info "The scoped-out member cannot patch or delete the document's comments"
request PATCH "/comments/$COMMENT_ID" '{"body":"hijacked"}'; expect_status 403
request DELETE "/comments/$COMMENT_ID"; expect_status 403

info "The owner still sees and can open the restricted doc"
login "$OWNER_EMAIL"
request GET /resources; expect_status 200
OWNS="$(printf '%s' "$LAST_BODY" | jq --arg id "$DOC_ID" '[.resources[] | select(.id==$id)] | length')"
request GET "/documents/$DOC_ID"; expect_status 200
[[ "$OWNS" == "1" ]] && pass "owner keeps access to their restricted doc" || { fail "owner lost their doc (n=$OWNS)"; FAILURES=$((FAILURES + 1)); }

info "Owner re-opens the doc to the whole Project"
request PATCH "/resources/document/$DOC_ID/access" '{"access":{"projectWide":true}}'; expect_status 200

info "The member's access is restored"
login "$MEMBER_EMAIL"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
request GET "/documents/$DOC_ID"; expect_status 200
request GET /resources; expect_status 200
BACK="$(printf '%s' "$LAST_BODY" | jq --arg id "$DOC_ID" '[.resources[] | select(.id==$id)] | length')"
[[ "$BACK" == "1" ]] && pass "member regains access after re-opening" || { fail "member did not regain access (n=$BACK)"; FAILURES=$((FAILURES + 1)); }

info "With access restored, the member can patch the comment again"
request PATCH "/comments/$COMMENT_ID" '{"body":"member note"}'; expect_status 200

finish
