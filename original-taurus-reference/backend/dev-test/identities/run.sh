#!/usr/bin/env bash
# Automated dev-test for the batch identity resolver: POST
# /projects/:id/identities/resolve turns a mixed list of user + persona references
# into public profile cards, project-authorized, with inaccessible references
# reported in `unavailable`. No model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register an owner (with an avatar), create + select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request PATCH /auth/me '{"avatarUrl":"/files/ada/meta","color":"#3b82f6"}'; expect_status 200
OWNER_ID="$(json_field id)"
request POST /projects '{"name":"Identity Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "The General persona is materialized on first read; capture its id"
request GET /personas; expect_status 200
PERSONA_ID="$(printf '%s' "$LAST_BODY" | jq -r '.personas[0].persona.id // .personas[0].id')"
info "persona id = $PERSONA_ID"

info "Resolve a mixed batch: the owner (user) + the persona + an unknown user"
request POST "/projects/$PROJECT_ID/identities/resolve" "{\"identities\":[
  {\"kind\":\"user\",\"id\":\"$OWNER_ID\"},
  {\"kind\":\"persona\",\"id\":\"$PERSONA_ID\"},
  {\"kind\":\"user\",\"id\":\"ghost\"}
]}"
expect_status 200
NPROF="$(printf '%s' "$LAST_BODY" | jq '.profiles | length')"
NUNAVAIL="$(printf '%s' "$LAST_BODY" | jq '.unavailable | length')"
USER_KIND="$(printf '%s' "$LAST_BODY" | jq -r '.profiles[] | select(.id=="'"$OWNER_ID"'") | .kind')"
USER_AVATAR="$(printf '%s' "$LAST_BODY" | jq -r '.profiles[] | select(.id=="'"$OWNER_ID"'") | .avatarUrl')"
USER_ROLE="$(printf '%s' "$LAST_BODY" | jq -r '.profiles[] | select(.id=="'"$OWNER_ID"'") | .role')"
PERSONA_KIND="$(printf '%s' "$LAST_BODY" | jq -r '.profiles[] | select(.id=="'"$PERSONA_ID"'") | .kind')"
GHOST="$(printf '%s' "$LAST_BODY" | jq -r '.unavailable[0].id')"
if [[ "$NPROF" == "2" && "$NUNAVAIL" == "1" && "$USER_KIND" == "user" && "$USER_AVATAR" == "/files/ada/meta" \
      && "$USER_ROLE" == "owner" && "$PERSONA_KIND" == "persona" && "$GHOST" == "ghost" ]]; then
  pass "resolved user (avatar+role) + persona; unknown user unavailable"
else
  fail "resolve wrong: nprof=$NPROF nunavail=$NUNAVAIL userKind=$USER_KIND avatar=$USER_AVATAR role=$USER_ROLE personaKind=$PERSONA_KIND ghost=$GHOST"
  FAILURES=$((FAILURES + 1))
fi

info "Duplicate references are resolved once"
request POST "/projects/$PROJECT_ID/identities/resolve" "{\"identities\":[
  {\"kind\":\"user\",\"id\":\"$OWNER_ID\"},
  {\"kind\":\"user\",\"id\":\"$OWNER_ID\"}
]}"
expect_status 200
DUP="$(printf '%s' "$LAST_BODY" | jq '.profiles | length')"
[[ "$DUP" == "1" ]] && pass "duplicate references deduplicated" || { fail "expected 1 profile, got $DUP"; FAILURES=$((FAILURES + 1)); }

info "A non-member cannot resolve identities in a project they don't belong to"
request POST /auth/register '{"email":"outsider@taurus.local","password":"password123","name":"Zed"}'; expect_status 201
request POST /auth/login '{"email":"outsider@taurus.local","password":"password123"}'; expect_status 200
request POST "/projects/$PROJECT_ID/identities/resolve" "{\"identities\":[{\"kind\":\"user\",\"id\":\"$OWNER_ID\"}]}"
expect_status 403

finish
