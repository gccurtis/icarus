#!/usr/bin/env bash
# Automated dev-test for the block-kind model: one `text` kind carrying a
# `subKind` (body + heading_1..6, plus user-defined sub-kinds), a first-class
# `code` block kind, and the removal of the old kinds. Covers creating text and
# code blocks, converting a text block's sub-kind in place (set_block_subkind),
# defining and applying a custom sub-kind, and a Markdown round-trip of the
# representable subset. No model is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create + select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Block Kinds Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document with a text (body) block and a code block"
request POST /documents '{"name":"Kinds","rows":[
  {"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]},
  {"id":"r2","blocks":[{"id":"c1","kind":"code","atoms":[{"id":"a2","kind":"text","text":"x := 1"}]}]}
]}'
expect_status 201
DOC_ID="$(json_field id)"
# A text block defaults to the body sub-kind; a code block carries no sub-kind.
SK_BODY="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].subKind')"
K_CODE="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[1].blocks[0].kind')"
if [[ "$SK_BODY" == "body" && "$K_CODE" == "code" ]]; then
  pass "text defaults to body sub-kind; code is its own kind"
else
  fail "create wrong: bodySubKind=$SK_BODY codeKind=$K_CODE"; FAILURES=$((FAILURES + 1))
fi

info "Convert the text block to a heading via set_block_subkind"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"sk-1","expectedRevision":0,"operations":[{"op":"set_block_subkind","blockId":"b1","setSubKind":"heading_2"}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
SK="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].subKind')"
[[ "$SK" == "heading_2" ]] && pass "text block converted to heading_2 in place" || { fail "subKind=$SK, want heading_2"; FAILURES=$((FAILURES + 1)); }

info "An unknown sub-kind (not built-in, not a registered style) is rejected"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"sk-bad","expectedRevision":1,"operations":[{"op":"set_block_subkind","blockId":"b1","setSubKind":"not-a-style"}]}'
expect_status 409

info "Define a custom sub-kind (a style definition applying to text) and apply it"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"sk-2","expectedRevision":1,"operations":[
  {"op":"put_style_definition","style":{"id":"note","name":"Note","appliesTo":["text"]}},
  {"op":"set_block_subkind","blockId":"b1","setSubKind":"note"}
]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
SK2="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].subKind')"
[[ "$SK2" == "note" ]] && pass "custom sub-kind applied" || { fail "subKind=$SK2, want note"; FAILURES=$((FAILURES + 1)); }

info "set_block_subkind is rejected on a code block (only text carries a sub-kind)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"sk-code","expectedRevision":2,"operations":[{"op":"set_block_subkind","blockId":"c1","setSubKind":"heading_1"}]}'
expect_status 409

info "Convert the text block to a callout kind; it exports as a blockquote"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"co-1","expectedRevision":2,"operations":[{"op":"set_block","blockId":"b1","setKind":"callout"}]}'
expect_status 201
request GET "/documents/$DOC_ID"; expect_status 200
CK="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].kind')"
CSK="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].subKind // "none"')"
[[ "$CK" == "callout" && "$CSK" == "none" ]] && pass "block converted to a callout (no sub-kind)" || { fail "kind=$CK subKind=$CSK"; FAILURES=$((FAILURES + 1)); }
request GET "/documents/$DOC_ID/export?format=markdown"; expect_status 200
grep -q '^> hello' <<<"$LAST_BODY" && pass "callout exported as a blockquote" || { fail "callout not a blockquote:\n$LAST_BODY"; FAILURES=$((FAILURES + 1)); }

info "Markdown import: headings, body, and a fenced code block"
MD='# Title

Body text.

```
line one

line three
```
'
CONTENT_B64="$(printf '%s' "$MD" | base64 | tr -d '\n')"
request POST /files "$(jq -nc --arg c "$CONTENT_B64" '{name:"kinds.md",contentType:"text/markdown",content:$c}')"; expect_status 201
FILE_ID="$(json_field id)"
request POST /documents/import "{\"fileId\":\"$FILE_ID\"}"; expect_status 201
IMP="$(json_field id)"
request GET "/documents/$IMP"; expect_status 200
KINDS="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[].kind] | join(",")')"
SUBKINDS="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[].subKind] | join(",")')"
CODE_TEXT="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[2].blocks[0].atoms[].text] | join("")')"
if [[ "$KINDS" == "text,text,code" && "$SUBKINDS" == "heading_1,body," && "$CODE_TEXT" == $'line one\n\nline three' ]]; then
  pass "import: kinds=$KINDS subKinds=$SUBKINDS; code preserved blank lines"
else
  fail "import wrong: kinds=$KINDS subKinds=$SUBKINDS code=$(printf '%q' "$CODE_TEXT")"; FAILURES=$((FAILURES + 1))
fi

info "Markdown export round-trips headings and the fenced code block"
request GET "/documents/$IMP/export?format=markdown"; expect_status 200
OUT="$LAST_BODY"
if grep -q '^# Title' <<<"$OUT" && grep -q '^```$' <<<"$OUT" && grep -q '^line one' <<<"$OUT" && grep -q '^line three' <<<"$OUT"; then
  pass "export reproduces heading and fenced code"
else
  fail "export missing expected content:\n$OUT"; FAILURES=$((FAILURES + 1))
fi

finish
