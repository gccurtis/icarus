#!/usr/bin/env bash
# Automated dev-test for project management and selection: list / create /
# select / current / delete (owner) / leave (self), plus the membership checks
# (only members may select; only owners may delete).
#
# Requests share a cookie jar (see ../lib.sh). The manual walkthrough is in
# manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Sign in"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200

echo
info "No projects yet"
request GET /projects
expect_status 200
expect_body '"projects":[]'

echo
info "Create a project (the creator becomes its owner)"
request POST /projects '{"name":"First Project"}'
expect_status 201
expect_body '"role":"owner"'
PROJECT_ID="$(json_field id)"
info "project id = $PROJECT_ID"

echo
info "It appears in the list with the owner role"
request GET /projects
expect_status 200
expect_body "$PROJECT_ID"
expect_body '"role":"owner"'

echo
info "The project carries icon and timestamps (icon empty until set)"
request GET /projects
expect_status 200
expect_body '"icon":""'
expect_body '"createdAt":'
expect_body '"updatedAt":'

echo
info "Rename it and set an icon (owner only, partial PATCH)"
request PATCH "/projects/$PROJECT_ID" '{"name":"Renamed Project","icon":"intel"}'
expect_status 200
expect_body '"name":"Renamed Project"'
expect_body '"icon":"intel"'

echo
info "Set and clear the Project purpose; an empty patch is invalid"
request PATCH "/projects/$PROJECT_ID" '{"purpose":"  Make knowledge useful.  "}'
expect_status 200
expect_body '"purpose":"Make knowledge useful."'
request PATCH "/projects/$PROJECT_ID" '{}'
expect_status 400
request PATCH "/projects/$PROJECT_ID" '{"purpose":""}'
expect_status 200
expect_body '"purpose":""'
request GET /projects
expect_status 200
expect_body '"name":"Renamed Project"'
expect_body '"icon":"intel"'

echo
info "An empty name is rejected"
request PATCH "/projects/$PROJECT_ID" '{"name":"  "}'
expect_status 400

echo
info "Nothing is selected yet"
request GET /session/project
expect_status 200
expect_body '"selected":false'

echo
info "Selecting a project you don't belong to is forbidden"
request POST /session/project '{"projectId":"does-not-exist"}'
expect_status 403

echo
info "Select the project (this creates the cell)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200
expect_body 'selected'

echo
info "It now shows as the current selection"
request GET /session/project
expect_status 200
expect_body '"selected":true'
expect_body "$PROJECT_ID"

echo
info "Create a second project, then delete it as its owner"
request POST /projects '{"name":"Second Project"}'
expect_status 201
SECOND_ID="$(json_field id)"
request DELETE "/projects/$SECOND_ID"
expect_status 200
expect_body 'deleted'
request GET /projects
expect_status 200
expect_body "$PROJECT_ID"

echo
info "Visibility: a project is private by default; the owner can set it to link"
request GET /projects
expect_status 200
expect_body '"visibility":"private"'
request PATCH "/projects/$PROJECT_ID" '{"visibility":"public"}'
expect_status 400
request PATCH "/projects/$PROJECT_ID" '{"visibility":"link"}'
expect_status 200
expect_body '"visibility":"link"'

echo
info "(Role-carrying share links — read/edit join by token, upgrade, and the"
info " private master switch — are covered by the links suite.)"

echo
info "Members: add an existing user by email (owner only)"
MEMBER_EMAIL="member@taurus.local"
request POST /auth/register "{\"email\":\"$MEMBER_EMAIL\",\"password\":\"password123\",\"name\":\"Member\"}"
expect_status 201
request POST "/projects/$PROJECT_ID/members" "{\"email\":\"$MEMBER_EMAIL\",\"role\":\"read\"}"
expect_status 201
expect_body '"role":"read"'
MEMBER_ID="$(json_field userId)"
info "member id = $MEMBER_ID"

echo
info "GET /projects carries a bounded, public-safe member summary"
request GET /projects
expect_status 200
SUMMARY="$(printf '%s' "$LAST_BODY" | jq ".projects[] | select(.id==\"$PROJECT_ID\") | .members")"
TOTAL="$(printf '%s' "$SUMMARY" | jq '.total')"
ITEMS="$(printf '%s' "$SUMMARY" | jq '.items | length')"
HAS_EMAIL="$(printf '%s' "$SUMMARY" | jq '[.items[] | has("email") or has("role")] | any')"
SAFE_FIELDS="$(printf '%s' "$SUMMARY" | jq '[.items[] | has("userId") and has("name") and has("avatarUrl")] | all')"
if [[ "$TOTAL" == "2" && "$ITEMS" == "2" && "$HAS_EMAIL" == "false" && "$SAFE_FIELDS" == "true" ]]; then
  pass "member summary: total=2, $ITEMS items, public-safe (no email/role)"
else
  fail "member summary wrong: total=$TOTAL items=$ITEMS hasEmail/role=$HAS_EMAIL safeFields=$SAFE_FIELDS"
  FAILURES=$((FAILURES + 1))
fi

echo
info "The member list now shows the owner and the new member"
request GET "/projects/$PROJECT_ID/members"
expect_status 200
expect_body "$DEV_EMAIL"
expect_body "$MEMBER_EMAIL"

echo
info "Adding an unknown email is 404, a duplicate is 409, a bad role is 400"
request POST "/projects/$PROJECT_ID/members" '{"email":"ghost@taurus.local","role":"read"}'
expect_status 404
request POST "/projects/$PROJECT_ID/members" "{\"email\":\"$MEMBER_EMAIL\",\"role\":\"read\"}"
expect_status 409
request POST "/projects/$PROJECT_ID/members" "{\"email\":\"$MEMBER_EMAIL\",\"role\":\"boss\"}"
expect_status 400

echo
info "Promote the member to edit, then remove them (owner only)"
request PATCH "/projects/$PROJECT_ID/members/$MEMBER_ID" '{"role":"edit"}'
expect_status 200
request DELETE "/projects/$PROJECT_ID/members/$MEMBER_ID"
expect_status 200
expect_body 'removed'

echo
info "The sole owner cannot leave — it would strand the project (409)"
request POST "/projects/$PROJECT_ID/leave"
expect_status 409

echo
info "Delete the project as its owner to clean up"
request DELETE "/projects/$PROJECT_ID"
expect_status 200
expect_body 'deleted'
request GET /projects
expect_status 200
expect_body '"projects":[]'

finish
