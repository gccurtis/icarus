#!/usr/bin/env bash
# Automated dev-test for documents — the first project-scoped resource. Documents
# require a selected project; within one you can list / create / fetch / delete
# them. A document is a name plus a base of rows; each row is a list of blocks,
# and each block holds inline text as an ordered list of atoms.
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
info "Documents require a selected project"
request GET /documents
expect_status 409
expect_body 'select a project first'

echo
info "Create and select a project"
request POST /projects '{"name":"Doc Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

echo
info "No documents yet"
request GET /documents
expect_status 200
expect_body '"documents":[]'

echo
info "Create a document — a name plus a row of blocks, each with text atoms"
request POST /documents '{"name":"Meeting Notes","rows":[{"blocks":[{"kind":"text","subKind":"heading_1","atoms":[{"kind":"text","text":"Agenda"}]},{"kind":"text","atoms":[{"kind":"text","text":"Discuss the roadmap"}]}]}]}'
expect_status 201
expect_body '"name":"Meeting Notes"'
expect_body '"text":"Discuss the roadmap"'
DOC_ID="$(json_field id)"
info "document id = $DOC_ID"

echo
info "It appears in the project's document list"
request GET /documents
expect_status 200
expect_body "$DOC_ID"

echo
info "Fetch it by id — blocks and atoms preserved, with server-assigned ids"
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"subKind":"heading_1"'
expect_body '"text":"Agenda"'

echo
info "An unknown document id is not found"
request GET /documents/does-not-exist
expect_status 404

echo
info "Delete moves the document to trash (soft delete); it is still retrievable"
request DELETE "/documents/$DOC_ID"
expect_status 200
expect_body 'trashed'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"lifecycle":"trashed"'

echo
info "Purge permanently removes the trashed document"
request DELETE "/documents/$DOC_ID/purge"
expect_status 200
request GET "/documents/$DOC_ID"
expect_status 404

finish
