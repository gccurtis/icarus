#!/usr/bin/env bash
# Automated dev-test for canonical Document link and typography admission:
# exploit payloads fail atomically with typed errors, while admitted mark and
# custom-typography values round-trip unchanged. No model is involved.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Typography Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a document with a single block"
request POST /documents '{"name":"Styled","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}'
expect_status 201
DOC="$(json_field id)"

info "Reject the exact stored-content exploit payloads without advancing revision"
request POST "/documents/$DOC/changes" '{"submissionId":"bad-link-1","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"link","attrs":{"href":"javascript:alert(1)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 400
expect_body '"code":"document.invalid_style"'
expect_body '"field":"link.href"'
request POST "/documents/$DOC/changes" '{"submissionId":"bad-link-2","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"link","attrs":{"href":"java\tscript:alert(1)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 400
request POST "/documents/$DOC/changes" '{"submissionId":"bad-font-1","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"font","attrs":{"family":"Arial;background:url(//evil.example)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 400
expect_body '"field":"font.family"'
request POST "/documents/$DOC/changes" '{"submissionId":"bad-font-2","expectedRevision":0,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"font","attrs":{"size":"calc(100vw)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 400
expect_body '"field":"font.size"'
request POST "/documents/$DOC/changes" '{"submissionId":"bad-custom-1","expectedRevision":0,"operations":[{"op":"set_block_custom_typography","blockId":"b1","customTypography":{"fg":"red;}html{display:none"}}]}'
expect_status 400
expect_body '"field":"color.fg"'
request GET "/documents/$DOC"; expect_status 200
REV="$(printf '%s' "$LAST_BODY" | jq '.revision')"
[[ "$REV" == "0" ]] && pass "unsafe writes left the revision unchanged" || { fail "revision=$REV, want 0"; FAILURES=$((FAILURES + 1)); }

info "Allow the documented absolute, relative, fragment, query, and mail link forms"
request POST /documents '{"name":"Safe links","rows":[{"id":"lr1","blocks":[{"id":"lb1","kind":"text","atoms":[{"id":"la1","kind":"text","text":"hello"}],"marks":[
  {"id":"l1","kind":"link","attrs":{"href":"https://example.com/x?y=1#z"},"start":{"atomId":"la1","offset":0},"end":{"atomId":"la1","offset":1}},
  {"id":"l2","kind":"link","attrs":{"href":"/docs/page"},"start":{"atomId":"la1","offset":1},"end":{"atomId":"la1","offset":2}},
  {"id":"l3","kind":"link","attrs":{"href":"#anchor"},"start":{"atomId":"la1","offset":2},"end":{"atomId":"la1","offset":3}},
  {"id":"l4","kind":"link","attrs":{"href":"?query=one"},"start":{"atomId":"la1","offset":3},"end":{"atomId":"la1","offset":4}},
  {"id":"l5","kind":"link","attrs":{"href":"mailto:a@b.c"},"start":{"atomId":"la1","offset":4},"end":{"atomId":"la1","offset":5}}
]}]}]}'
expect_status 201

info "Set canonical custom typography on the block"
request POST "/documents/$DOC/changes" '{"submissionId":"ct-1","expectedRevision":0,"operations":[{"op":"set_block_custom_typography","blockId":"b1","customTypography":{"fontFamily":"Comic Sans MS","fontSize":"13.5pt","fg":"rgb(1, 2, 3)"}}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
FAM="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef.overrides.custom.fontFamily')"
SIZE="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef.overrides.custom.fontSize')"
COLOR="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef.overrides.custom.fg')"
if [[ "$FAM" == "Comic Sans MS" && "$SIZE" == "13.5pt" && "$COLOR" == "rgb(1, 2, 3)" ]]; then
  pass "canonical typography stored unchanged (family=$FAM size=$SIZE color=$COLOR)"
else
  fail "typography not stored: family=$FAM size=$SIZE color=$COLOR"
  FAILURES=$((FAILURES + 1))
fi

info "Replace with a different value set"
request POST "/documents/$DOC/changes" '{"submissionId":"ct-2","expectedRevision":1,"operations":[{"op":"set_block_custom_typography","blockId":"b1","customTypography":{"fg":"#ff0000"}}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
NEWCOLOR="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef.overrides.custom.fg')"
NOFAM="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef.overrides.custom.fontFamily // "absent"')"
if [[ "$NEWCOLOR" == "#ff0000" && "$NOFAM" == "absent" ]]; then
  pass "replace swapped the whole custom typography (color=$NEWCOLOR, family absent)"
else
  fail "replace wrong: color=$NEWCOLOR family=$NOFAM"
  FAILURES=$((FAILURES + 1))
fi

info "Clear the custom typography (nil payload) — the bare style ref collapses"
request POST "/documents/$DOC/changes" '{"submissionId":"ct-3","expectedRevision":2,"operations":[{"op":"set_block_custom_typography","blockId":"b1"}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
REF="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].styleRef // "absent"')"
if [[ "$REF" == "absent" ]]; then
  pass "clearing removed the custom-only style ref"
else
  fail "style ref should be gone after clear: $REF"
  FAILURES=$((FAILURES + 1))
fi

info "An over-long font family is rejected"
BIG="$(printf 'x%.0s' {1..200})"
request POST "/documents/$DOC/changes" "{\"submissionId\":\"ct-4\",\"expectedRevision\":3,\"operations\":[{\"op\":\"set_block_custom_typography\",\"blockId\":\"b1\",\"customTypography\":{\"fontFamily\":\"$BIG\"}}]}"
expect_status 400

info "Set a general block indent"
request POST "/documents/$DOC/changes" '{"submissionId":"in-1","expectedRevision":3,"operations":[{"op":"set_block_indent","blockId":"b1","indent":4}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
INDENT="$(printf '%s' "$LAST_BODY" | jq '.base.rows[0].blocks[0].style.indent')"
[[ "$INDENT" == "4" ]] && pass "block indent set to 4" || { fail "indent=$INDENT, want 4"; FAILURES=$((FAILURES + 1)); }

info "An indent past the maximum is rejected"
request POST "/documents/$DOC/changes" '{"submissionId":"in-2","expectedRevision":4,"operations":[{"op":"set_block_indent","blockId":"b1","indent":99}]}'
expect_status 400

info "Set a document default typography (the lowest custom cascade level)"
request POST "/documents/$DOC/changes" '{"submissionId":"dt-1","expectedRevision":4,"operations":[{"op":"set_default_typography","customTypography":{"fontFamily":"Georgia","fg":"#222222"}}]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
DEF="$(printf '%s' "$LAST_BODY" | jq -r '.base.defaultTypography.fontFamily // "absent"')"
[[ "$DEF" == "Georgia" ]] && pass "document default typography set" || { fail "defaultTypography=$DEF"; FAILURES=$((FAILURES + 1)); }

info "Add inline color, background, and font marks over the atom"
request POST "/documents/$DOC/changes" '{"submissionId":"mk-1","expectedRevision":5,"operations":[
  {"op":"add_mark","blockId":"b1","mark":{"id":"mc","kind":"fg","attrs":{"value":"#ff0000"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}},
  {"op":"add_mark","blockId":"b1","mark":{"id":"mg","kind":"bg","attrs":{"value":"rgb(255, 255, 0)"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}},
  {"op":"add_mark","blockId":"b1","mark":{"id":"mf","kind":"font","attrs":{"family":"IBM Plex Sans, Helvetica, '\''Segoe UI'\'', sans-serif","size":"16px"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}},
  {"op":"add_mark","blockId":"b1","mark":{"id":"mf2","kind":"font","attrs":{"size":"1.5rem"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}
]}'
expect_status 201
request GET "/documents/$DOC"; expect_status 200
MK="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[0].blocks[0].marks[].kind] | sort | join(",")')"
[[ "$MK" == "bg,fg,font,font" ]] && pass "exact Alpha color/background/font allowlist stored" || { fail "marks=$MK"; FAILURES=$((FAILURES + 1)); }

info "An unsafe color mark is rejected"
request POST "/documents/$DOC/changes" '{"submissionId":"mk-bad","expectedRevision":6,"operations":[{"op":"add_mark","blockId":"b1","mark":{"id":"mx","kind":"fg","attrs":{"value":"red;danger"},"start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 400

info "Markdown export drops non-representable inline styling"
request GET "/documents/$DOC/export?format=markdown"; expect_status 200
OUT="$LAST_BODY"
if ! grep -qiE "ff0000|rgb\(|IBM Plex|1\\.5rem|color|font" <<<"$OUT"; then
  pass "export dropped font/color/background styling"
else
  fail "export leaked inline styling:\n$OUT"; FAILURES=$((FAILURES + 1))
fi

finish
