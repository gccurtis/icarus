#!/usr/bin/env bash
# Automated dev-test for the formula name manager: the
# /projects/:projectID/names/* and /projects/:projectID/evaluate endpoints.
# The manager is a pure, deterministic state layer — no model calls, no cost —
# so this suite always runs.
#
# Exercises the full surface end to end against the real server: set a scalar
# and evaluate an expression that reads it; set a table and evaluate an
# aggregate over one of its columns; append rows and add a column to that
# table; set a function and evaluate a call to it; get one name and list all
# of them; delete a name. A negative case (a reserved entry name) asserts 400.

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
info "Create a project to hold the names namespace"
request POST /projects '{"name":"Formula Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
info "project id = $PROJECT_ID"

echo
info "Set a scalar value under a name"
request PUT "/projects/$PROJECT_ID/names/price/value" \
  '{"kind":"number","shape":{"fields":1,"rows":1},"number":"42"}'
expect_status 200
expect_body '"status":"set"'

echo
info "Evaluate an expression that reads it"
request POST "/projects/$PROJECT_ID/evaluate" '{"source":"price * 2"}'
expect_status 200
expect_body '"number":"84"'

echo
info "Create an empty table via the constructive POST route"
request POST "/projects/$PROJECT_ID/names/orders/table" \
  '{"columns":[{"name":"qty","type":"number"}]}'
expect_status 201
expect_body '"status":"created"'

echo
info "Creating the same name again is a conflict (409)"
request POST "/projects/$PROJECT_ID/names/orders/table" \
  '{"columns":[{"name":"qty","type":"number"}]}'
expect_status 409

echo
info "Set a table wholesale (columns + rows)"
request PUT "/projects/$PROJECT_ID/names/items/table" \
  '{"columns":[{"name":"qty","type":"number"},{"name":"label","type":"text"}],"rows":[[{"kind":"number","shape":{"fields":1,"rows":1},"number":"10"},{"kind":"text","shape":{"fields":1,"rows":1},"text":"widget"}],[{"kind":"number","shape":{"fields":1,"rows":1},"number":"5"},{"kind":"text","shape":{"fields":1,"rows":1},"text":"gadget"}]]}'
expect_status 200
expect_body '"status":"set"'

echo
info "Evaluate SUM over one of the table's columns"
request POST "/projects/$PROJECT_ID/evaluate" '{"source":"SUM(items.qty)"}'
expect_status 200
expect_body '"number":"15"'

echo
info "Append rows to the table"
request POST "/projects/$PROJECT_ID/names/items/rows" \
  '{"rows":[[{"kind":"number","shape":{"fields":1,"rows":1},"number":"3"},{"kind":"text","shape":{"fields":1,"rows":1},"text":"thing"}]]}'
expect_status 200
expect_body '"status":"set"'
request POST "/projects/$PROJECT_ID/evaluate" '{"source":"SUM(items.qty)"}'
expect_status 200
expect_body '"number":"18"'

echo
info "Add a column to the table"
request POST "/projects/$PROJECT_ID/names/items/columns" '{"name":"active","type":"logic"}'
expect_status 200
expect_body '"status":"set"'
request GET "/projects/$PROJECT_ID/names/items"
expect_status 200
expect_body '"active"'
expect_body '"kind":"null"'

echo
info "Set a function and evaluate a call to it"
request PUT "/projects/$PROJECT_ID/names/double/function" '{"source":"FUNCTION(n, n * 2)"}'
expect_status 200
expect_body '"status":"set"'
request POST "/projects/$PROJECT_ID/evaluate" '{"source":"double(21)"}'
expect_status 200
expect_body '"number":"42"'

echo
info "Get one name"
request GET "/projects/$PROJECT_ID/names/price"
expect_status 200
expect_body '"name":"price"'
expect_body '"number":"42"'

echo
info "List every name in the namespace"
request GET "/projects/$PROJECT_ID/names"
expect_status 200
expect_body '"price"'
expect_body '"items"'
expect_body '"double"'

echo
info "Delete a name"
request DELETE "/projects/$PROJECT_ID/names/double"
expect_status 200
expect_body '"status":"deleted"'
request GET "/projects/$PROJECT_ID/names/double"
expect_status 404

echo
info "A reserved name is rejected (400)"
request PUT "/projects/$PROJECT_ID/names/SUM/value" \
  '{"kind":"number","shape":{"fields":1,"rows":1},"number":"1"}'
expect_status 400

echo
info "A read member may read but not write"
READER_EMAIL="reader@taurus.local"
request POST /auth/register "{\"email\":\"$READER_EMAIL\",\"password\":\"password123\",\"name\":\"Reader\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request POST "/projects/$PROJECT_ID/join"
expect_status 404
info "The project is private, so a read member is added explicitly instead"
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST "/projects/$PROJECT_ID/members" "{\"email\":\"$READER_EMAIL\",\"role\":\"read\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"password123\"}"
expect_status 200
request GET "/projects/$PROJECT_ID/names/price"
expect_status 200
request PUT "/projects/$PROJECT_ID/names/price/value" \
  '{"kind":"number","shape":{"fields":1,"rows":1},"number":"99"}'
expect_status 403

finish
