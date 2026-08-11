#!/usr/bin/env bash
# Automated dev-test for role-carrying share links: an owner mints read/edit
# links; other users join by token (read, then upgraded to edit — never
# downgraded); the visibility=private master switch disables links; and
# rotate / delete / unknown tokens all 404. The manual walkthrough is in
# manual.md.
#
# Requests share a cookie jar (see ../lib.sh); a POST /auth/login swaps identity.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Owner signs in and creates a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Shared Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
info "project id = $PROJECT_ID"

echo
info "Owner mints a read link and an edit link; an owner link is rejected"
request PUT "/projects/$PROJECT_ID/links/read"
expect_status 200
expect_body '"role":"read"'
TOKEN_READ="$(json_field token)"
request PUT "/projects/$PROJECT_ID/links/edit"
expect_status 200
expect_body '"role":"edit"'
TOKEN_EDIT="$(json_field token)"
request PUT "/projects/$PROJECT_ID/links/owner"
expect_status 400

echo
info "Both links are listed (owner only)"
request GET "/projects/$PROJECT_ID/links"
expect_status 200
expect_body "$TOKEN_READ"
expect_body "$TOKEN_EDIT"

echo
info "While the project is private, the link does not work (404, never revealing it)"
JOINER_EMAIL="joiner@taurus.local"
request POST /auth/register "{\"email\":\"$JOINER_EMAIL\",\"password\":\"password123\",\"name\":\"Joiner\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$JOINER_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/join/$TOKEN_READ"
expect_status 404

echo
info "Owner turns sharing on (visibility = link)"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request PATCH "/projects/$PROJECT_ID" '{"visibility":"link"}'
expect_status 200
expect_body '"visibility":"link"'

echo
info "The joiner uses the read link → read member; the project appears in their list"
request POST /auth/login "{\"email\":\"$JOINER_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/join/$TOKEN_READ"
expect_status 200
expect_body '"role":"read"'
request GET /projects
expect_status 200
expect_body "$PROJECT_ID"

echo
info "The edit link upgrades them to edit; the read link never downgrades"
request POST "/join/$TOKEN_EDIT"
expect_status 200
expect_body '"role":"edit"'
request POST "/join/$TOKEN_READ"
expect_status 200
expect_body '"role":"edit"'

echo
info "A member who is not the owner cannot list or mint links (403)"
request GET "/projects/$PROJECT_ID/links"
expect_status 403
request PUT "/projects/$PROJECT_ID/links/read"
expect_status 403

echo
info "Owner rotates the read link; the old token stops working, the new one works"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request PUT "/projects/$PROJECT_ID/links/read"
expect_status 200
TOKEN_READ2="$(json_field token)"
FRESH_EMAIL="fresh@taurus.local"
request POST /auth/register "{\"email\":\"$FRESH_EMAIL\",\"password\":\"password123\",\"name\":\"Fresh\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$FRESH_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/join/$TOKEN_READ"
expect_status 404
request POST "/join/$TOKEN_READ2"
expect_status 200
expect_body '"role":"read"'

echo
info "Owner deletes the edit link; that token stops working"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request DELETE "/projects/$PROJECT_ID/links/edit"
expect_status 200
expect_body 'deleted'
NEWBIE_EMAIL="newbie@taurus.local"
request POST /auth/register "{\"email\":\"$NEWBIE_EMAIL\",\"password\":\"password123\",\"name\":\"Newbie\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$NEWBIE_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/join/$TOKEN_EDIT"
expect_status 404

echo
info "Flipping back to private disables the surviving link; unknown tokens 404 too"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request PATCH "/projects/$PROJECT_ID" '{"visibility":"private"}'
expect_status 200
request POST /auth/login "{\"email\":\"$NEWBIE_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/join/$TOKEN_READ2"
expect_status 404
request POST /join/no-such-token
expect_status 404

finish
