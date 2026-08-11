#!/usr/bin/env bash
# Automated dev-test for organizations: a user creates an organization (becoming
# its owner), adds a second user as a member, the member sees the org with the
# member role but cannot rename it, the owner can, and the last owner is protected
# from removal. Organizations are above-Project, so no Project is selected. No
# model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

A_EMAIL="owner@taurus.local"
B_EMAIL="member@taurus.local"
PW="devpassword"

login() { request POST /auth/login "{\"email\":\"$1\",\"password\":\"$PW\"}"; expect_status 200; }

info "Register two users and capture their IDs"
request POST /auth/register "{\"email\":\"$A_EMAIL\",\"password\":\"$PW\"}"; expect_status 201
request POST /auth/register "{\"email\":\"$B_EMAIL\",\"password\":\"$PW\"}"; expect_status 201
login "$A_EMAIL"; request GET /auth/me; expect_status 200; A_ID="$(json_field id)"
login "$B_EMAIL"; request GET /auth/me; expect_status 200; B_ID="$(json_field id)"
info "owner=$A_ID member=$B_ID"

info "Owner creates an organization"
login "$A_EMAIL"
request POST /organizations '{"name":"Acme"}'; expect_status 201
ORG_ID="$(json_field id)"
ROLE="$(json_field role)"
if [[ -n "$ORG_ID" && "$ROLE" == "owner" ]]; then
  pass "created org $ORG_ID as owner"
else
  fail "create org wrong: id=$ORG_ID role=$ROLE"; FAILURES=$((FAILURES + 1))
fi

info "Owner sees the org in their list"
request GET /organizations; expect_status 200
MINE="$(printf '%s' "$LAST_BODY" | jq --arg id "$ORG_ID" '[.organizations[] | select(.id==$id)] | length')"
[[ "$MINE" == "1" ]] && pass "owner lists the org" || { fail "owner list missing org (n=$MINE)"; FAILURES=$((FAILURES + 1)); }

info "Owner adds the second user as a member"
request POST "/organizations/$ORG_ID/members" "{\"userId\":\"$B_ID\",\"role\":\"member\"}"; expect_status 201
request GET "/organizations/$ORG_ID/members"; expect_status 200
NMEM="$(printf '%s' "$LAST_BODY" | jq '.members | length')"
[[ "$NMEM" == "2" ]] && pass "org has 2 members" || { fail "member count wrong: $NMEM"; FAILURES=$((FAILURES + 1)); }

info "The member sees the org with the member role"
login "$B_EMAIL"
request GET /organizations; expect_status 200
BROLE="$(printf '%s' "$LAST_BODY" | jq -r --arg id "$ORG_ID" '.organizations[] | select(.id==$id) | .role')"
[[ "$BROLE" == "member" ]] && pass "member sees org as 'member'" || { fail "member role wrong: '$BROLE'"; FAILURES=$((FAILURES + 1)); }

info "A plain member cannot rename the org (403)"
request PATCH "/organizations/$ORG_ID" '{"name":"Hijacked"}'; expect_status 403

info "A member cannot mint an owner (403)"
request POST "/organizations/$ORG_ID/members" "{\"userId\":\"$B_ID\",\"role\":\"owner\"}"; expect_status 403

info "The owner can rename the org"
login "$A_EMAIL"
request PATCH "/organizations/$ORG_ID" '{"name":"Acme Inc"}'; expect_status 200
NEWNAME="$(json_field name)"
[[ "$NEWNAME" == "Acme Inc" ]] && pass "owner renamed org" || { fail "rename wrong: '$NEWNAME'"; FAILURES=$((FAILURES + 1)); }

info "The last owner cannot be removed (409)"
request DELETE "/organizations/$ORG_ID/members/$A_ID"; expect_status 409

info "The owner removes the member (204)"
request DELETE "/organizations/$ORG_ID/members/$B_ID"; expect_status 204

info "The removed member no longer sees the org"
login "$B_EMAIL"
request GET /organizations; expect_status 200
STILL="$(printf '%s' "$LAST_BODY" | jq --arg id "$ORG_ID" '[.organizations[] | select(.id==$id)] | length')"
[[ "$STILL" == "0" ]] && pass "removed member no longer sees the org" || { fail "member still sees org (n=$STILL)"; FAILURES=$((FAILURES + 1)); }

finish
