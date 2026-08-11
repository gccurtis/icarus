#!/usr/bin/env bash
# Automated dev-test for Markdown import and export: a Markdown file is uploaded,
# imported into a new document (headings, quote, and bold inline preserved), then
# exported back to Markdown. An unsupported export format is rejected. No model
# is involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Import Export Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

MD='# Title

Body with **bold** text.

## Section

> A quote line.
'
CONTENT_B64="$(printf '%s' "$MD" | base64 | tr -d '\n')"

info "Upload the Markdown file"
request POST /files "$(jq -nc --arg c "$CONTENT_B64" '{name:"notes.md",contentType:"text/markdown",content:$c}')"
expect_status 201
FILE_ID="$(json_field id)"

info "Import the file into a new document"
request POST /documents/import "{\"fileId\":\"$FILE_ID\"}"
expect_status 201
DOC="$(json_field id)"
expect_body '"name":"notes"'   # extension dropped

info "The imported document has the right block structure"
request GET "/documents/$DOC"; expect_status 200
K0="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].subKind')"
T0="$(printf '%s' "$LAST_BODY" | jq -r '.base.rows[0].blocks[0].atoms[0].text')"
KINDS="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[].kind] | join(",")')"
SUBKINDS="$(printf '%s' "$LAST_BODY" | jq -r '[.base.rows[].blocks[].subKind] | join(",")')"
BOLD="$(printf '%s' "$LAST_BODY" | jq '[.base.rows[].blocks[].marks[]? | select(.kind=="bold")] | length')"
# Every block is a text block; the sub-kind carries the semantic role. A quote is
# body text — the "> " marker is dropped on import (Markdown is lossy).
if [[ "$K0" == "heading_1" && "$T0" == "Title" && "$KINDS" == "text,text,text,text" && "$SUBKINDS" == "heading_1,body,heading_2,body" && "$BOLD" -ge 1 ]]; then
  pass "import structure: kinds=$KINDS subKinds=$SUBKINDS (bold marks: $BOLD)"
else
  fail "import structure wrong: k0=$K0 t0=$T0 kinds=$KINDS subKinds=$SUBKINDS bold=$BOLD"
  FAILURES=$((FAILURES + 1))
fi

info "Export the document back to Markdown"
request GET "/documents/$DOC/export?format=markdown"; expect_status 200
OUT="$LAST_BODY"
if grep -q '^# Title' <<<"$OUT" && grep -q '^## Section' <<<"$OUT" && grep -q '^A quote line.' <<<"$OUT" && grep -q '\*\*bold\*\*' <<<"$OUT"; then
  pass "export reproduces headings and bold inline (quote marker dropped, lossy)"
else
  fail "export missing expected content:\n$OUT"
  FAILURES=$((FAILURES + 1))
fi

info "An unsupported export format is rejected"
request GET "/documents/$DOC/export?format=pdf"; expect_status 400

finish
