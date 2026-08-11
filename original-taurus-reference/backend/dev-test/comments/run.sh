#!/usr/bin/env bash
# Automated dev-test for anchored comments: a comment is pinned to a document
# anchor (created inline), listed, replied to, resolved (with the open/resolved
# filter), and deleted (cascading its replies). A comment against a bogus anchor
# is rejected. No model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Comment Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document to comment on"
request POST /documents '{"name":"Reviewed","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello world"}]}]}]}'
expect_status 201
DOC="$(json_field id)"

info "Open a comment on an inline anchor over the first five bytes"
request POST "/documents/$DOC/comments" '{"body":"please cite this","anchor":{"rowId":"r1","blockId":"b1","atomId":"a1","start":0,"end":5}}'
expect_status 201
COMMENT="$(json_field id)"
ANCHOR="$(printf '%s' "$LAST_BODY" | jq -r '.anchorId')"
if [[ -n "$ANCHOR" && "$ANCHOR" != "null" ]]; then
  pass "comment created and bound to a fresh anchor ($ANCHOR)"
else
  fail "comment missing an anchor id"
  FAILURES=$((FAILURES + 1))
fi

info "A comment against a nonexistent anchor is rejected"
request POST "/documents/$DOC/comments" '{"body":"orphan","anchorId":"does-not-exist"}'
expect_status 404

info "List shows the open comment"
request GET "/documents/$DOC/comments"; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.comments | length')"
RESOLVED="$(printf '%s' "$LAST_BODY" | jq -r '.comments[0].resolved')"
ORPHANED="$(printf '%s' "$LAST_BODY" | jq -r '.comments[0].anchorOrphaned')"
if [[ "$N" == "1" && "$RESOLVED" == "false" && "$ORPHANED" == "false" ]]; then
  pass "one open comment on a live anchor"
else
  fail "unexpected list: n=$N resolved=$RESOLVED orphaned=$ORPHANED"
  FAILURES=$((FAILURES + 1))
fi

info "Reply to the comment, then confirm the thread"
request POST "/comments/$COMMENT/replies" '{"body":"good catch"}'; expect_status 201
request POST "/comments/$COMMENT/replies" '{"body":"will fix"}'; expect_status 201
request GET "/documents/$DOC/comments"; expect_status 200
RN="$(printf '%s' "$LAST_BODY" | jq '.comments[0].replies | length')"
R0="$(printf '%s' "$LAST_BODY" | jq -r '.comments[0].replies[0].body')"
if [[ "$RN" == "2" && "$R0" == "good catch" ]]; then
  pass "two replies in order"
else
  fail "unexpected replies: n=$RN first=$R0"
  FAILURES=$((FAILURES + 1))
fi

info "Resolve the comment and check the open/resolved filters"
request PATCH "/comments/$COMMENT" '{"resolved":true}'; expect_status 200
expect_body '"resolved":true'
request GET "/documents/$DOC/comments?resolved=false"; expect_status 200
OPEN_N="$(printf '%s' "$LAST_BODY" | jq '.comments | length')"
request GET "/documents/$DOC/comments?resolved=true"; expect_status 200
DONE_N="$(printf '%s' "$LAST_BODY" | jq '.comments | length')"
if [[ "$OPEN_N" == "0" && "$DONE_N" == "1" ]]; then
  pass "resolved filter: open=0 resolved=1"
else
  fail "filter wrong: open=$OPEN_N resolved=$DONE_N"
  FAILURES=$((FAILURES + 1))
fi

info "Delete the comment; the thread is gone"
request DELETE "/comments/$COMMENT"; expect_status 200
request GET "/documents/$DOC/comments"; expect_status 200
AFTER="$(printf '%s' "$LAST_BODY" | jq '.comments | length')"
if [[ "$AFTER" == "0" ]]; then
  pass "comment (and its replies) deleted"
else
  fail "comment survived delete: n=$AFTER"
  FAILURES=$((FAILURES + 1))
fi

finish
