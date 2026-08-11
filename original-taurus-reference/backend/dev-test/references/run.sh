#!/usr/bin/env bash
# Automated dev-test for the reference graph: a document that links to another
# gains an outgoing reference; the target gains a backlink; external links are
# dropped; target names resolve at read time; and editing away the link
# re-indexes the document so the edge disappears. No model is involved, so this
# suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Reference Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create the link target document"
request POST /documents '{"name":"Target","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"I am the target."}]}]}]}'
expect_status 201
DOC_A="$(json_field id)"

info "Create a document that links to the target and, separately, to an external URL"
LINKER="$(jq -nc --arg a "$DOC_A" '{
  name:"Linker",
  rows:[
    {id:"r1",blocks:[{id:"b1",kind:"text",
      atoms:[{id:"a1",kind:"text",text:"see target"}],
      marks:[{id:"m1",kind:"link",attrs:{href:$a},start:{atomId:"a1",offset:0},end:{atomId:"a1",offset:10}}]}]},
    {id:"r2",blocks:[{id:"b2",kind:"text",
      atoms:[{id:"a2",kind:"text",text:"external"}],
      marks:[{id:"m2",kind:"link",attrs:{href:"https://example.com"},start:{atomId:"a2",offset:0},end:{atomId:"a2",offset:8}}]}]}
  ]
}')"
request POST /documents "$LINKER"; expect_status 201
DOC_B="$(json_field id)"

info "The linker's outgoing references: exactly the internal edge (external dropped)"
request GET "/documents/$DOC_B/references"; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.references | length')"
TO_ID="$(printf '%s' "$LAST_BODY" | jq -r '.references[0].toResource.id // ""')"
TO_NAME="$(printf '%s' "$LAST_BODY" | jq -r '.references[0].toResource.name // ""')"
ANCHOR="$(printf '%s' "$LAST_BODY" | jq -r '.references[0].anchor // ""')"
KIND="$(printf '%s' "$LAST_BODY" | jq -r '.references[0].kind // ""')"
if [[ "$N" == "1" && "$TO_ID" == "$DOC_A" && "$TO_NAME" == "Target" && "$ANCHOR" == "b1" && "$KIND" == "link" ]]; then
  pass "one outgoing edge -> Target (anchor b1, kind link); external link dropped"
else
  fail "unexpected references: n=$N to=$TO_ID name=$TO_NAME anchor=$ANCHOR kind=$KIND"
  FAILURES=$((FAILURES + 1))
fi

info "The target's backlinks name the linker"
request GET "/documents/$DOC_A/backlinks"; expect_status 200
BN="$(printf '%s' "$LAST_BODY" | jq '.backlinks | length')"
FROM_ID="$(printf '%s' "$LAST_BODY" | jq -r '.backlinks[0].fromResource.id // ""')"
FROM_NAME="$(printf '%s' "$LAST_BODY" | jq -r '.backlinks[0].fromResource.name // ""')"
if [[ "$BN" == "1" && "$FROM_ID" == "$DOC_B" && "$FROM_NAME" == "Linker" ]]; then
  pass "one backlink <- Linker"
else
  fail "unexpected backlinks: n=$BN from=$FROM_ID name=$FROM_NAME"
  FAILURES=$((FAILURES + 1))
fi

info "Renaming the target updates the name resolved on the linker's edge"
request PATCH "/documents/$DOC_A" '{"name":"Target Renamed"}'; expect_status 200
request GET "/documents/$DOC_B/references"; expect_status 200
NEW_NAME="$(printf '%s' "$LAST_BODY" | jq -r '.references[0].toResource.name // ""')"
if [[ "$NEW_NAME" == "Target Renamed" ]]; then
  pass "edge target name resolves to the current name"
else
  fail "edge name not re-resolved: $NEW_NAME"
  FAILURES=$((FAILURES + 1))
fi

info "Editing away the link re-indexes the document, dropping the edge"
request POST "/documents/$DOC_B/changes" '{"submissionId":"drop-link-1","expectedRevision":0,"operations":[{"op":"delete_block","rowId":"r1","blockId":"b1"}]}'
expect_status 201
request GET "/documents/$DOC_B/references"; expect_status 200
AFTER="$(printf '%s' "$LAST_BODY" | jq '.references | length')"
request GET "/documents/$DOC_A/backlinks"; expect_status 200
AFTER_BACK="$(printf '%s' "$LAST_BODY" | jq '.backlinks | length')"
if [[ "$AFTER" == "0" && "$AFTER_BACK" == "0" ]]; then
  pass "after deleting the linking block, the edge and its backlink are gone"
else
  fail "edge not re-indexed after edit: references=$AFTER backlinks=$AFTER_BACK"
  FAILURES=$((FAILURES + 1))
fi

finish
