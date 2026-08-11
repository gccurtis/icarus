#!/usr/bin/env bash
# Automated dev-test for document templates: a document is marked as a template
# with named context variables, one variable is bound document-wide, it shows up
# in the template list, and instantiating it produces a new working document with
# the structure copied and the bindings cleared. No model is involved (the ops are
# deterministic), so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Template Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document, then mark it as a template with two context variables"
request POST /documents '{"name":"Customer Brief","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"Brief"}]}]}]}'
expect_status 201
DOC="$(json_field id)"
request POST "/documents/$DOC/changes" '{"submissionId":"t1","expectedRevision":0,"operations":[{"op":"set_template","template":{"isTemplate":true,"variables":[{"name":"customer","description":"the customer this brief is for"},{"name":"product","description":"the product in scope"}]}}]}'
expect_status 201

info "Bind one variable document-wide"
request POST "/documents/$DOC/changes" '{"submissionId":"t2","expectedRevision":1,"operations":[{"op":"set_context_variable","contextVarName":"customer","boundContext":"Acme Corp"}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
BOUND="$(printf '%s' "$LAST_BODY" | jq -r '.base.template.variables[] | select(.name=="customer") | .boundContext')"
IS_TMPL="$(printf '%s' "$LAST_BODY" | jq -r '.base.template.isTemplate')"
if [[ "$BOUND" == "Acme Corp" && "$IS_TMPL" == "true" ]]; then
  pass "template marked, variable bound (customer=Acme Corp)"
else
  fail "template/binding wrong: isTemplate=$IS_TMPL bound=$BOUND"
  FAILURES=$((FAILURES + 1))
fi

info "Binding an undeclared variable is rejected"
request POST "/documents/$DOC/changes" '{"submissionId":"t3","expectedRevision":2,"operations":[{"op":"set_context_variable","contextVarName":"ghost","boundContext":"x"}]}'
expect_status 409

info "The template appears in the template list"
request GET /documents/templates; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.templates | length')"
TID="$(printf '%s' "$LAST_BODY" | jq -r '.templates[0].id')"
if [[ "$N" == "1" && "$TID" == "$DOC" ]]; then
  pass "template list shows the template"
else
  fail "template list wrong: n=$N id=$TID"
  FAILURES=$((FAILURES + 1))
fi

info "Instantiate the template: structure copied, bindings cleared, not a template"
request POST /documents "{\"fromTemplateId\":\"$DOC\"}"
expect_status 201
INST="$(json_field id)"
request GET "/documents/$INST"; expect_status 200
INST_IS_TMPL="$(printf '%s' "$LAST_BODY" | jq -r '.base.template.isTemplate')"
INST_VARS="$(printf '%s' "$LAST_BODY" | jq '.base.template.variables | length')"
INST_BOUND="$(printf '%s' "$LAST_BODY" | jq -r '.base.template.variables[] | select(.name=="customer") | .boundContext // ""')"
INST_ROWS="$(printf '%s' "$LAST_BODY" | jq '.base.rows | length')"
if [[ "$INST_IS_TMPL" == "false" && "$INST_VARS" == "2" && -z "$INST_BOUND" && "$INST_ROWS" -ge 1 ]]; then
  pass "instance: not a template, 2 variables kept, bindings cleared, structure copied"
else
  fail "instance wrong: isTemplate=$INST_IS_TMPL vars=$INST_VARS bound='$INST_BOUND' rows=$INST_ROWS"
  FAILURES=$((FAILURES + 1))
fi

info "Instantiating a non-template document is a 404"
request POST /documents '{"name":"Plain","rows":[]}'; expect_status 201
PLAIN="$(json_field id)"
request POST /documents "{\"fromTemplateId\":\"$PLAIN\"}"
expect_status 404

finish
