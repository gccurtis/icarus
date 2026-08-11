#!/usr/bin/env bash
# Automated dev-test for the login gateway: without a user the only reachable
# endpoints are register and login; after logging in, the gated endpoints (echo,
# me) open up; after logout they close again. Exercises both the seeded dev user
# and a freshly registered account.
#
# Requests share a cookie jar (see ../lib.sh), so the session from login carries
# through. The manual walkthrough is in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Anonymous: gated endpoints are refused"
request POST /echo '{"hello":"world"}'
expect_status 401
expect_body 'sign in required'
request GET /auth/me
expect_status 401

echo
info "Register the dev user (no seeding — created via the API)"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201

echo
info "Log in as the dev user"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
expect_body 'signed in'

echo
info "Signed in: /auth/me reports the user"
request GET /auth/me
expect_status 200
expect_body "$DEV_EMAIL"

echo
info "Signed in: the gated echo endpoint now works"
request POST /echo '{"hello":"world"}'
expect_status 200
expect_body '"hello":"world"'

echo
info "Wrong password is refused"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"wrong-password\"}"
expect_status 401

echo
info "A brand-new account can register (with a display name) and then sign in"
request POST /auth/register '{"email":"newuser@example.com","password":"password123","name":"New User"}'
expect_status 201
expect_body '"email":"newuser@example.com"'
expect_body '"name":"New User"'
request POST /auth/login '{"email":"newuser@example.com","password":"password123"}'
expect_status 200
request GET /auth/me
expect_status 200
expect_body 'newuser@example.com'
expect_body '"name":"New User"'

echo
info "The display name can be changed via PATCH /auth/me"
request PATCH /auth/me '{"name":"Renamed User"}'
expect_status 200
expect_body '"name":"Renamed User"'
request GET /auth/me
expect_status 200
expect_body '"name":"Renamed User"'

echo
info "Log out, and the gated endpoints close again"
request POST /auth/logout
expect_status 200
request POST /echo '{"hello":"world"}'
expect_status 401

finish
