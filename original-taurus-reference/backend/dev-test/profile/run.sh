#!/usr/bin/env bash
# Automated dev-test for per-user identity (BR-USER-AVATAR): PATCH /auth/me sets
# color and avatarUrl, they come back on /auth/me, they enrich the project-peer
# projection at GET /users/:userID, and an invalid color is rejected. Identity is
# the one user-scoped (not project-scoped) feature. No model is involved.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register and log in"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request GET /auth/me; expect_status 200
USER_ID="$(json_field id)"

info "Set name, color, and avatar via PATCH /auth/me"
request PATCH /auth/me '{"name":"Ann","color":"#3b82f6","avatarUrl":"/files/abc/meta"}'
expect_status 200
expect_body '"color":"#3b82f6"'
expect_body '"avatarUrl":"/files/abc/meta"'
expect_body '"name":"Ann"'

info "The values persist on /auth/me"
request GET /auth/me; expect_status 200
expect_body '"color":"#3b82f6"'
expect_body '"avatarUrl":"/files/abc/meta"'

info "A partial update leaves other fields unchanged"
request PATCH /auth/me '{"color":"teal"}'; expect_status 200
expect_body '"name":"Ann"'
expect_body '"color":"teal"'
expect_body '"avatarUrl":"/files/abc/meta"'

info "Identity enriches the project-peer projection"
request POST /projects '{"name":"Profile Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
request GET "/users/$USER_ID"; expect_status 200
expect_body '"color":"teal"'
expect_body '"avatarUrl":"/files/abc/meta"'
expect_body '"name":"Ann"'

info "An invalid color is rejected"
request PATCH /auth/me '{"color":"not a color!"}'; expect_status 400

finish
