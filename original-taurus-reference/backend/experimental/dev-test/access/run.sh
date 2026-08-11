#!/usr/bin/env bash
# Automated dev-test for the access flow: register → login → create project →
# select project → reach a project-scoped route (and confirm the cell resolves),
# plus the negative cases that enforce the state machine and project isolation.
#
# Requests share a cookie jar (see ../lib.sh), so the session from login carries
# through to the later calls. The manual walkthrough is in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Before sign-in, protected routes are refused"
request GET /auth/me
expect_status 401

echo
info "Register a new account"
request POST /auth/register '{"email":"dev@example.com","password":"password123"}'
expect_status 201
expect_body '"email":"dev@example.com"'

echo
info "Registering the same email again is rejected"
request POST /auth/register '{"email":"dev@example.com","password":"password123"}'
expect_status 409

echo
info "Log in (sets the session cookie in the jar)"
request POST /auth/login '{"email":"dev@example.com","password":"password123"}'
expect_status 200
expect_body 'signed in'

echo
info "Now signed in: /auth/me reports the user"
request GET /auth/me
expect_status 200
expect_body '"email":"dev@example.com"'

echo
info "Create a project"
request POST /projects '{"name":"First Project"}'
expect_status 201
expect_body '"name":"First Project"'
PROJECT_ID="$(json_field id)"
info "project id = $PROJECT_ID"

echo
info "It appears in the user's project list"
request GET /projects
expect_status 200
expect_body "$PROJECT_ID"

echo
info "Reaching the project before selecting it is refused (state machine)"
request GET "/projects/$PROJECT_ID/whoami"
expect_status 409
expect_body 'select a project first'

echo
info "Select the project (this creates the cell)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200
expect_body 'project selected'

echo
info "Project-scoped whoami now resolves the user, project, and cell"
request GET "/projects/$PROJECT_ID/whoami"
expect_status 200
expect_body "$PROJECT_ID"

echo
info "Project isolation: a different project id in the path is forbidden"
request GET "/projects/some-other-project/whoami"
expect_status 403

echo
info "The project-scoped echo endpoint works within the selected project"
request POST "/projects/$PROJECT_ID/echo" '{"hello":"cell"}'
expect_status 200
expect_body '"hello":"cell"'

echo
info "Log out, and the session no longer works"
request POST /auth/logout
expect_status 200
request GET /auth/me
expect_status 401

finish
