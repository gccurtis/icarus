#!/usr/bin/env bash
# Automated dev-test for document change sets — how a document is edited. A change
# set is a batch of row/block/atom/mark ops authored by a user; reads return the
# *resolved* document (the base with all pending change sets applied).
#
# Requests share a cookie jar (see ../lib.sh). The manual walkthrough is in
# manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Doc Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

echo
info "Create a document with one row, one block and one text atom"
request POST /documents '{"name":"Notes","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}'
expect_status 201
expect_body '"revision":0'
expect_body '"width":612'
expect_body '"maxFontHeight":24'
expect_body '"lineHeight":0'
expect_body '"horizontalAlign":"left"'
expect_body '"verticalAlign":"top"'
DOC_ID="$(json_field id)"
info "document id = $DOC_ID"

echo
info "Edit the atom's text with a set_atom_text change (author + seq recorded)"
FIRST_SUBMISSION='{"submissionId":"dev-edit-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"hello, world"}]}'
request POST "/documents/$DOC_ID/changes" "$FIRST_SUBMISSION"
expect_status 201
expect_body '"seq":1'
expect_body '"priorRevision":0'
expect_body '"submissionId":"dev-edit-1"'
expect_body '"authorId"'
FIRST_CHANGE_ID="$(json_field id)"

echo
info "An identical retry returns the original revision without another edit"
request POST "/documents/$DOC_ID/changes" "$FIRST_SUBMISSION"
expect_status 201
expect_body "\"id\":\"$FIRST_CHANGE_ID\""
expect_body '"seq":1'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"revision":1'

echo
info "History exposes a bounded summary and retained detail without the inverse"
request GET "/documents/$DOC_ID/history?limit=1"
expect_status 200
expect_body "\"id\":\"$FIRST_CHANGE_ID\""
expect_body '"revision":1'
expect_body '"operationTypes":["set_atom_text"]'
expect_body '"atomIds":["a1"]'
expect_body '"canUndo":true'
request GET "/documents/$DOC_ID/history/$FIRST_CHANGE_ID"
expect_status 200
expect_body "\"id\":\"$FIRST_CHANGE_ID\""
expect_no_body 'inverseOps'

echo
info "A distinct stale submission returns a bounded resync conflict"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-stale-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"stale"}]}'
expect_status 409
expect_body '"code":"document_revision_conflict"'
expect_body '"currentRevision":1'
expect_body '"resyncRevision":1'

echo
info "The resolved document reflects the edit"
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"text":"hello, world"'
expect_body '"revision":1'

echo
info "Bold the first word with an add_mark change"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-mark-1","expectedRevision":1,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"bold","start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
expect_status 201
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"kind":"bold"'
expect_body '"revision":2'

echo
info "Insert a heading row at the top"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-row-1","expectedRevision":2,"operations":[{"op":"insert_row","afterRow":"","row":{"id":"r0","blocks":[{"id":"b0","kind":"text","subKind":"heading_1","atoms":[{"id":"a0","kind":"text","text":"Title"}]}]}}]}'
expect_status 201
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"text":"Title"'
expect_body '"text":"hello, world"'

echo
info "Insert an atom, confirm it, then delete it"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-atom-insert-1","expectedRevision":3,"operations":[{"op":"insert_atom","blockId":"b1","afterAtom":"a1","atom":{"id":"a2","kind":"text","text":" and more"}}]}'
expect_status 201
request GET "/documents/$DOC_ID"
expect_body '"text":" and more"'
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-atom-delete-1","expectedRevision":4,"operations":[{"op":"delete_atom","blockId":"b1","atomId":"a2"}]}'
expect_status 201
DELETE_CHANGE_ID="$(json_field id)"
request GET "/documents/$DOC_ID"
expect_status 200
expect_no_body '"text":" and more"'

echo
info "Undo the current authored revision by its change-set id"
request POST "/documents/$DOC_ID/changes/$DELETE_CHANGE_ID/undo"
expect_status 201
expect_body "\"undoOf\":\"$DELETE_CHANGE_ID\""
expect_body '"seq":6'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"text":" and more"'
expect_body '"revision":6'

echo
info "An older revision is not undone over later work"
request POST "/documents/$DOC_ID/changes/$FIRST_CHANGE_ID/undo"
expect_status 409
expect_body 'current head revision'

echo
info "Set block line height and alignment in one authored revision"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-style-1","expectedRevision":6,"operations":[{"op":"set_block_line_height","blockId":"b1","lineHeight":18},{"op":"set_block_alignment","blockId":"b1","horizontalAlign":"center","verticalAlign":"bottom"}]}'
expect_status 201
expect_body '"seq":7'
STYLE_CHANGE_ID="$(json_field id)"
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"lineHeight":18'
expect_body '"horizontalAlign":"center"'
expect_body '"verticalAlign":"bottom"'

echo
info "Undo and explicit redo restore the exact style values"
request POST "/documents/$DOC_ID/changes/$STYLE_CHANGE_ID/redo"
expect_status 409
request POST "/documents/$DOC_ID/changes/$STYLE_CHANGE_ID/undo"
expect_status 201
expect_body '"seq":8'
STYLE_UNDO_ID="$(json_field id)"
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"lineHeight":0'
expect_body '"horizontalAlign":"left"'
expect_body '"verticalAlign":"top"'
request POST "/documents/$DOC_ID/changes/$STYLE_UNDO_ID/undo"
expect_status 409
request POST "/documents/$DOC_ID/changes/$STYLE_UNDO_ID/redo"
expect_status 201
expect_body '"seq":9'
expect_body "\"redoOf\":\"$STYLE_UNDO_ID\""
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"lineHeight":18'
expect_body '"horizontalAlign":"center"'
expect_body '"verticalAlign":"bottom"'

echo
info "Change and undo document-wide page geometry"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-layout-1","expectedRevision":9,"operations":[{"op":"set_page_layout","pageLayout":{"width":500,"height":700,"marginTop":50,"marginRight":40,"marginBottom":50,"marginLeft":40}}]}'
expect_status 201
expect_body '"seq":10'
LAYOUT_CHANGE_ID="$(json_field id)"
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"width":500'
request POST "/documents/$DOC_ID/changes/$LAYOUT_CHANGE_ID/undo"
expect_status 201
expect_body '"seq":11'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"width":612'

echo
info "A block line height above the allowed range is rejected"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-bad-height","expectedRevision":11,"operations":[{"op":"set_block_line_height","blockId":"b1","lineHeight":145}]}'
expect_status 400

echo
info "A change referencing content that no longer exists is rejected (intent preservation)"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-missing-atom","expectedRevision":11,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"does-not-exist","setText":"x"}]}'
expect_status 409
expect_body 'no longer matches current document state'

echo
info "An empty change set is rejected"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-empty","expectedRevision":11,"operations":[]}'
expect_status 400

echo
info "Splice UTF-8 text against its exact prior digest"
TEXT_HASH="$(printf %s 'hello, world' | sha256sum | awk '{print $1}')"
request POST "/documents/$DOC_ID/changes" "{\"submissionId\":\"dev-splice-1\",\"expectedRevision\":11,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"b1\",\"atomId\":\"a1\",\"startOffset\":5,\"endOffset\":5,\"insertText\":\" safely\",\"expectedTextHash\":\"$TEXT_HASH\"}]}"
expect_status 201
expect_body '"seq":12'
expect_body '"operationTypes":["splice_atom_text"]'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"text":"hello safely, world"'

echo
info "Move a row without replacing its stable identity"
request POST "/documents/$DOC_ID/changes" '{"submissionId":"dev-move-row-1","expectedRevision":12,"operations":[{"op":"move_row","rowId":"r1","fromAfterRow":"r0","afterRow":""}]}'
expect_status 201
expect_body '"seq":13'
request GET "/documents/$DOC_ID"
expect_status 200
expect_body '"revision":13'

echo
info "Split and join the minimal single-atom text Block without changing identities"
request POST /documents '{"name":"Split Notes","rows":[{"id":"sr1","blocks":[{"id":"sb1","kind":"text","atoms":[{"id":"sa1","kind":"text","text":"hello"}]}]}]}'
expect_status 201
SPLIT_DOC_ID="$(json_field id)"
HELLO_HASH="$(printf %s 'hello' | sha256sum | awk '{print $1}')"
request POST "/documents/$SPLIT_DOC_ID/changes" "{\"submissionId\":\"dev-split-1\",\"expectedRevision\":0,\"operations\":[{\"op\":\"split_block\",\"blockId\":\"sb1\",\"atomId\":\"sa1\",\"startOffset\":2,\"expectedTextHash\":\"$HELLO_HASH\",\"row\":{\"id\":\"sr2\",\"blocks\":[{\"id\":\"sb2\",\"kind\":\"text\",\"atoms\":[{\"id\":\"sa2\",\"kind\":\"text\",\"text\":\"\"}]}]}}]}"
expect_status 201
expect_body '"seq":1'
request GET "/documents/$SPLIT_DOC_ID"
expect_status 200
expect_body '"text":"he"'
expect_body '"text":"llo"'
LEFT_HASH="$(printf %s 'he' | sha256sum | awk '{print $1}')"
RIGHT_HASH="$(printf %s 'llo' | sha256sum | awk '{print $1}')"
request POST "/documents/$SPLIT_DOC_ID/changes" "{\"submissionId\":\"dev-join-1\",\"expectedRevision\":1,\"operations\":[{\"op\":\"join_blocks\",\"blockId\":\"sb1\",\"otherBlockId\":\"sb2\",\"expectedTextHash\":\"$LEFT_HASH\",\"expectedOtherTextHash\":\"$RIGHT_HASH\"}]}"
expect_status 201
expect_body '"seq":2'
request GET "/documents/$SPLIT_DOC_ID"
expect_status 200
expect_body '"text":"hello"'
expect_no_body '"id":"sr2"'

echo
info "Rebase a stale splice only when retained history proves it is disjoint"
request POST /documents '{"name":"Rebase Notes","rows":[{"id":"rr1","blocks":[{"id":"rb1","kind":"text","atoms":[{"id":"ra1","kind":"text","text":"abcdef"}]}]}]}'
expect_status 201
REBASE_DOC_ID="$(json_field id)"
ORIGINAL_HASH="$(printf %s 'abcdef' | sha256sum | awk '{print $1}')"
request POST "/documents/$REBASE_DOC_ID/changes" "{\"submissionId\":\"dev-rebase-first\",\"expectedRevision\":0,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"rb1\",\"atomId\":\"ra1\",\"startOffset\":0,\"endOffset\":1,\"insertText\":\"AA\",\"expectedTextHash\":\"$ORIGINAL_HASH\"}]}"
expect_status 201
expect_body '"authoredRevision":0'
expect_body '"priorRevision":0'
request POST "/documents/$REBASE_DOC_ID/changes" "{\"submissionId\":\"dev-rebase-disjoint\",\"expectedRevision\":0,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"rb1\",\"atomId\":\"ra1\",\"startOffset\":4,\"endOffset\":5,\"insertText\":\"\",\"expectedTextHash\":\"$ORIGINAL_HASH\"}]}"
expect_status 201
expect_body '"authoredRevision":0'
expect_body '"priorRevision":1'
expect_body '"seq":2'
request GET "/documents/$REBASE_DOC_ID"
expect_status 200
expect_body '"text":"AAbcdf"'
expect_body '"revision":2'

echo
info "An overlapping stale splice still fails with the bounded resync head"
request POST "/documents/$REBASE_DOC_ID/changes" "{\"submissionId\":\"dev-rebase-overlap\",\"expectedRevision\":0,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"rb1\",\"atomId\":\"ra1\",\"startOffset\":0,\"endOffset\":2,\"insertText\":\"x\",\"expectedTextHash\":\"$ORIGINAL_HASH\"}]}"
expect_status 409
expect_body '"code":"document_revision_conflict"'
expect_body '"currentRevision":2'
expect_body '"resyncRevision":2'
request GET "/documents/$REBASE_DOC_ID/history"
expect_status 200
expect_body '"authoredRevision":0'
expect_body '"priorRevision":1'

finish
