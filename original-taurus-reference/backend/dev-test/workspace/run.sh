#!/usr/bin/env bash
# Automated dev-test for per-user workspace state: a user's opaque per-project
# cockpit state (open tabs, panel geometry) is saved with PUT /workspace and read
# back with GET /workspace, isolated per user and per project, and bounded. The
# state is stored and returned verbatim. No model is involved, so this suite
# always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register two users; user 1 creates and selects a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Workspace Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "GET before any save returns an empty state (updatedAt null)"
request GET /workspace; expect_status 200
UA="$(printf '%s' "$LAST_BODY" | jq -r '.updatedAt')"
[[ "$UA" == "null" ]] && pass "unset workspace returns updatedAt null" || { fail "updatedAt=$UA, want null"; FAILURES=$((FAILURES + 1)); }

info "PUT a workspace state, then read it back verbatim"
request PUT /workspace '{"tabs":["doc-1","doc-2"],"activeTabId":"doc-1","context":{"width":320,"collapsed":false}}'
expect_status 200
request GET /workspace; expect_status 200
TABS="$(printf '%s' "$LAST_BODY" | jq -r '.tabs | join(",")')"
ACTIVE="$(printf '%s' "$LAST_BODY" | jq -r '.activeTabId')"
WIDTH="$(printf '%s' "$LAST_BODY" | jq '.context.width')"
STAMP="$(printf '%s' "$LAST_BODY" | jq -r '.updatedAt')"
if [[ "$TABS" == "doc-1,doc-2" && "$ACTIVE" == "doc-1" && "$WIDTH" == "320" && "$STAMP" != "null" ]]; then
  pass "workspace state stored and returned verbatim with updatedAt"
else
  fail "state wrong: tabs=$TABS active=$ACTIVE width=$WIDTH stamp=$STAMP"; FAILURES=$((FAILURES + 1))
fi

info "A second PUT replaces the whole state (last write wins)"
request PUT /workspace '{"tabs":["only"],"activeTabId":"only"}'
expect_status 200
request GET /workspace; expect_status 200
TABS2="$(printf '%s' "$LAST_BODY" | jq -r '.tabs | join(",")')"
[[ "$TABS2" == "only" ]] && pass "state replaced wholesale" || { fail "tabs=$TABS2, want only"; FAILURES=$((FAILURES + 1)); }

info "A non-object body is rejected"
request PUT /workspace '[1,2,3]'; expect_status 400

info "An oversized state is rejected"
BIG="$(printf 'a%.0s' {1..70000})"
request PUT /workspace "{\"blob\":\"$BIG\"}"; expect_status 413

info "The same user in a different project has a separate (empty) workspace"
request POST /projects '{"name":"Other Project"}'; expect_status 201
OTHER_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$OTHER_ID\"}"; expect_status 200
request GET /workspace; expect_status 200
UA2="$(printf '%s' "$LAST_BODY" | jq -r '.updatedAt')"
[[ "$UA2" == "null" ]] && pass "workspace is per-project (other project empty)" || { fail "other project updatedAt=$UA2, want null"; FAILURES=$((FAILURES + 1)); }

info "A second user sees their own empty workspace in their own project"
request POST /auth/register '{"email":"second@taurus.local","password":"password123"}'; expect_status 201
request POST /auth/login '{"email":"second@taurus.local","password":"password123"}'; expect_status 200
request POST /projects '{"name":"Second User Project"}'; expect_status 201
SECOND_PROJECT="$(json_field id)"
request POST /session/project "{\"projectId\":\"$SECOND_PROJECT\"}"; expect_status 200
request GET /workspace; expect_status 200
UA3="$(printf '%s' "$LAST_BODY" | jq -r '.updatedAt')"
[[ "$UA3" == "null" ]] && pass "second user is isolated (empty workspace)" || { fail "second user updatedAt=$UA3, want null"; FAILURES=$((FAILURES + 1)); }

finish
