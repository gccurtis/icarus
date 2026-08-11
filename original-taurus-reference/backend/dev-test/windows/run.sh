#!/usr/bin/env bash
# Automated dev-test for windowed row reads: a body-less descriptor and a row
# manifest describe a multi-row document; a row window returns exactly the
# requested rows (by index and by row id, clamped at the end); locate maps an
# atom and an index to a row; and every projection's revision advances after an
# edit. No model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Windows Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a four-row document"
request POST /documents '{"name":"Long","rows":[
  {"id":"r0","blocks":[{"id":"b0","kind":"text","atoms":[{"id":"a0","kind":"text","text":"row zero body"}]}]},
  {"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"row one body"}]}]},
  {"id":"r2","blocks":[{"id":"b2","kind":"text","atoms":[{"id":"a2","kind":"text","text":"row two body"}]}]},
  {"id":"r3","blocks":[{"id":"b3","kind":"text","atoms":[{"id":"a3","kind":"text","text":"row three body"}]}]}
]}'
expect_status 201
DOC="$(json_field id)"

info "Descriptor reports the row count with no row bodies"
request GET "/documents/$DOC/descriptor"; expect_status 200
RC="$(printf '%s' "$LAST_BODY" | jq -r '.rowCount')"
HAS_ROWS="$(printf '%s' "$LAST_BODY" | jq 'has("rows")')"
REV0="$(printf '%s' "$LAST_BODY" | jq -r '.revision')"
if [[ "$RC" == "4" && "$HAS_ROWS" == "false" ]]; then
  pass "descriptor rowCount=4, no row bodies (revision $REV0)"
else
  fail "descriptor wrong: rowCount=$RC hasRows=$HAS_ROWS"
  FAILURES=$((FAILURES + 1))
fi

info "Row manifest lists metrics with a cumulative first offset of zero"
request GET "/documents/$DOC/row-manifest"; expect_status 200
MN="$(printf '%s' "$LAST_BODY" | jq '.rows | length')"
OFF0="$(printf '%s' "$LAST_BODY" | jq -r '.rows[0].offset')"
H0="$(printf '%s' "$LAST_BODY" | jq -r '.rows[0].height')"
if [[ "$MN" == "4" && "$OFF0" == "0" && "$H0" -gt 0 ]]; then
  pass "manifest has 4 metrics; first offset 0, positive height $H0"
else
  fail "manifest wrong: n=$MN offset0=$OFF0 height0=$H0"
  FAILURES=$((FAILURES + 1))
fi

info "A window by index returns exactly the requested rows"
request GET "/documents/$DOC/rows?from=1&count=2"; expect_status 200
W1="$(printf '%s' "$LAST_BODY" | jq -r '[.rows[].id] | join(",")')"
FROM1="$(printf '%s' "$LAST_BODY" | jq -r '.from')"
if [[ "$W1" == "r1,r2" && "$FROM1" == "1" ]]; then
  pass "window from=1 count=2 -> r1,r2"
else
  fail "index window wrong: rows=$W1 from=$FROM1"
  FAILURES=$((FAILURES + 1))
fi

info "A window by row id past the end clamps to the last row"
request GET "/documents/$DOC/rows?from=r3&count=10"; expect_status 200
W2="$(printf '%s' "$LAST_BODY" | jq -r '[.rows[].id] | join(",")')"
if [[ "$W2" == "r3" ]]; then
  pass "window from=r3 count=10 -> r3 (clamped)"
else
  fail "id window wrong: rows=$W2"
  FAILURES=$((FAILURES + 1))
fi

info "Locate maps an atom id and an index to a row"
request GET "/documents/$DOC/rows/locate?anchor=a2"; expect_status 200
LR="$(printf '%s' "$LAST_BODY" | jq -r '.rowId')"
LI="$(printf '%s' "$LAST_BODY" | jq -r '.index')"
request GET "/documents/$DOC/rows/locate?index=3"; expect_status 200
LR2="$(printf '%s' "$LAST_BODY" | jq -r '.rowId')"
if [[ "$LR" == "r2" && "$LI" == "2" && "$LR2" == "r3" ]]; then
  pass "locate anchor=a2 -> r2 (index 2); index=3 -> r3"
else
  fail "locate wrong: anchor->($LR,$LI) index3->$LR2"
  FAILURES=$((FAILURES + 1))
fi

info "Editing the document advances the projection revision"
request POST "/documents/$DOC/changes" '{"submissionId":"win-edit-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b0","atomId":"a0","setText":"edited zero"}]}'
expect_status 201
request GET "/documents/$DOC/descriptor"; expect_status 200
REV1="$(printf '%s' "$LAST_BODY" | jq -r '.revision')"
if [[ "$REV1" != "$REV0" ]]; then
  pass "descriptor revision advanced $REV0 -> $REV1"
else
  fail "revision did not change after edit: still $REV1"
  FAILURES=$((FAILURES + 1))
fi

finish
