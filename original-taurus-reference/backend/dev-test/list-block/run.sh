#!/usr/bin/env bash
# Automated dev-test for the native `list` block kind: a single list block holds
# its items internally. Covers creating a list, editing items (insert/replace/
# remove/re-level/check via set_list_item), changing the marker type
# (set_list_type), replacing the whole payload (set_block_data), and a Markdown
# round-trip of bullet, ordered, and check lists. No model is involved, so this
# suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create + select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"List Block Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document with a bullet list block (two items)"
request POST /documents '{"name":"Lists","rows":[{"id":"r1","blocks":[{"id":"l1","kind":"list","data":{"type":"bullet","items":[
  {"level":0,"atoms":[{"kind":"text","text":"first"}]},
  {"level":0,"atoms":[{"kind":"text","text":"second"}]}
]}}]}]}'
expect_status 201
DOC_ID="$(json_field id)"
N="$(printf '%s' "$LAST_BODY" | jq '.base.rows[0].blocks[0].data.items | length')"
[[ "$N" == "2" ]] && pass "list block created with 2 items" || { fail "items=$N, want 2"; FAILURES=$((FAILURES + 1)); }

info "Append a nested item (set_list_item at index == len)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"li-1","expectedRevision":0,"operations":[{"op":"set_list_item","blockId":"l1","listIndex":2,"item":{"level":1,"atoms":[{"kind":"text","text":"nested"}]}}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
LEVEL="$(printf '%s' "$LAST_BODY" | jq '.base.rows[0].blocks[0].data.items[2].level')"
[[ "$LEVEL" == "1" ]] && pass "appended item at level 1" || { fail "level=$LEVEL, want 1"; FAILURES=$((FAILURES + 1)); }

info "Remove the first item (nil item)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"li-2","expectedRevision":1,"operations":[{"op":"set_list_item","blockId":"l1","listIndex":0}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
FIRST="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].data.items[0].atoms[0].text')"
[[ "$FIRST" == "second" ]] && pass "first item removed (now 'second')" || { fail "first=$FIRST, want second"; FAILURES=$((FAILURES + 1)); }

info "Change the marker type to ordered starting at 3 (set_list_type)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"lt-1","expectedRevision":2,"operations":[{"op":"set_list_type","blockId":"l1","setListType":"ordered","listStart":3}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
TYPE="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].data.type')"
START="$(printf '%s' "$LAST_BODY" | jq '.base.rows[0].blocks[0].data.start')"
[[ "$TYPE" == "ordered" && "$START" == "3" ]] && pass "list is ordered, start 3" || { fail "type=$TYPE start=$START"; FAILURES=$((FAILURES + 1)); }

info "Replace the whole payload with a check list (set_block_data)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"bd-1","expectedRevision":3,"operations":[{"op":"set_block_data","blockId":"l1","listData":{"type":"check","items":[
  {"level":0,"checked":true,"atoms":[{"kind":"text","text":"done"}]},
  {"level":0,"atoms":[{"kind":"text","text":"todo"}]}
]}}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
CHECKED="$(printf '%s' "$LAST_BODY" | jq '.base.rows[0].blocks[0].data.items[0].checked')"
[[ "$CHECKED" == "true" ]] && pass "payload replaced with a check list" || { fail "checked=$CHECKED"; FAILURES=$((FAILURES + 1)); }

info "A list op on a non-list block is rejected"
request POST /documents '{"name":"Text","rows":[{"id":"tr","blocks":[{"id":"tb","kind":"text","atoms":[{"kind":"text","text":"hi"}]}]}]}'
expect_status 201
TDOC="$(json_field id)"
request POST "/documents/$TDOC/changes" '{"submissionId":"bad-1","expectedRevision":0,"operations":[{"op":"set_list_type","blockId":"tb","setListType":"ordered"}]}'
expect_status 409

info "Markdown round-trip: bullet, ordered, and check lists"
MD='- alpha
- beta

1. one
2. two

- [ ] todo
- [x] done
'
CONTENT_B64="$(printf '%s' "$MD" | base64 | tr -d '\n')"
request POST /files "$(jq -nc --arg c "$CONTENT_B64" '{name:"lists.md",contentType:"text/markdown",content:$c}')"; expect_status 201
FILE_ID="$(json_field id)"
request POST /documents/import "{\"fileId\":\"$FILE_ID\"}"; expect_status 201
IMP="$(json_field id)"
request GET "/documents/$IMP"; expect_status 200
TYPES="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[0].data.type] | join(",")')"
[[ "$TYPES" == "bullet,ordered,check" ]] && pass "import: three list blocks ($TYPES)" || { fail "types=$TYPES"; FAILURES=$((FAILURES + 1)); }

request GET "/documents/$IMP/export?format=markdown"; expect_status 200
OUT="$LAST_BODY"
if grep -q '^- alpha' <<<"$OUT" && grep -q '^1. one' <<<"$OUT" && grep -q '^2. two' <<<"$OUT" && grep -q '^- \[x\] done' <<<"$OUT"; then
  pass "export reproduces bullet, ordered numbering, and checkboxes"
else
  fail "export missing expected list content:\n$OUT"; FAILURES=$((FAILURES + 1))
fi

finish
