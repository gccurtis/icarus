# Manual test: document change sets

This is the by-hand version of [`run.sh`](run.sh). It shows how a document is
**edited**: you append **change sets** — batches of layout/row/block/atom/mark
operations — and reads return the **resolved** document (the base with all
pending change sets applied).

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, with the
session cookie in `-b cookies.txt`.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Start the core (`go run ./core`), sign in, **select a project** (see the
  [projects manual](../projects/manual.md)), and create a document (see the
  [documents manual](../documents/manual.md)) with known ids, e.g.
  `{"name":"Notes","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}`.
  Call its id `<DOC_ID>`.

## The submission envelope

An edit declares the exact head it was authored against and carries a stable
client idempotency key:

```json
{
  "submissionId": "edit-1",
  "expectedRevision": 0,
  "operations": []
}
```

Retry the identical envelope after a lost response; the server returns the
original accepted ChangeSet without advancing the Document again. Reusing the
same `submissionId` with a different revision or operation payload returns
`409 document_submission_conflict`. For a new submission against an old
revision, the backend uses retained ChangeSets and operation preconditions to
prove whether the edit is disjoint from every intervening operation. A proven
safe edit is transformed and admitted; overlap or insufficient retained proof
returns `409 document_revision_conflict` with `currentRevision` and
`resyncRevision`.

`submissionId` is scoped to the Document and authenticated author. It is
required, non-blank, free of control characters, and at most 128 UTF-8 bytes.
`expectedRevision` is also required and cannot be negative.

## The change operations

Each operation is addressed **by id**:

| op | fields |
|---|---|
| `insert_row` | `afterRow` (`""` = top), `row` |
| `delete_row` | `rowId` |
| `insert_block` | `rowId`, `afterBlock` (`""` = start), `block` |
| `delete_block` | `blockId` |
| `set_block` | `blockId`, `setKind` |
| `set_block_alignment` | `blockId`, optional `horizontalAlign` (`left`, `center`, `right`), optional `verticalAlign` (`top`, `middle`, `bottom`) |
| `set_row_height` | `rowId`, `heightIncrease` |
| `set_page_layout` | `pageLayout` |
| `insert_atom` | `blockId`, `afterAtom` (`""` = start), `atom` |
| `delete_atom` | `blockId`, `atomId` |
| `set_atom_text` | `blockId`, `atomId`, `setText` |
| `splice_atom_text` | `blockId`, `atomId`, `startOffset`, `endOffset`, `insertText`, `expectedTextHash` |
| `move_row` | `rowId`, `fromAfterRow`, `afterRow` |
| `move_block` | `blockId`, `fromRowId`, `fromAfterBlock`, destination `rowId`, `afterBlock` |
| `move_atom` | `atomId`, `fromBlockId`, `fromAfterAtom`, destination `blockId`, `afterAtom` |
| `add_mark` | `blockId`, `mark` (a range over the block's atoms) |
| `remove_mark` | `blockId`, `markId` |
| `update_mark` | `blockId`, `markId`, complete replacement `mark`, `expectedMarkHash` |
| `split_block` | `blockId`, `atomId`, `startOffset`, `expectedTextHash`, empty one-Block/one-Atom `row` |
| `join_blocks` | left `blockId`, right `otherBlockId`, `expectedTextHash`, `expectedOtherTextHash` |

## 1. Edit an atom's text

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"edit-1","expectedRevision":0,"operations":[{"op":"set_atom_text","blockId":"b1","atomId":"a1","setText":"hello, world"}]}'
```

Expected: **201 Created** with the stored change set. Starting at `revision: 0`,
this first change set has `authoredRevision: 0`, `priorRevision: 0`, `seq: 1`, and
`submissionId: "edit-1"`. Its bounded `summary` names `set_atom_text` and the
affected block/atom IDs without duplicating their content.

The change set ID is also the source ID of its bounded `edited` Activity event.
The change set remains the detailed revision record, including its operations
and trusted author; Activity is the safe project-feed projection of that same
accepted effect.

A read-only member gets **403**; missing/invalid envelope fields or empty
`operations` get **400**.

## 2. Reads return the resolved document

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/documents/<DOC_ID>
```

The atom's `text` is now `"hello, world"` and the document reports
`"revision":1` — the base plus your change, resolved on read. A block's display
text is the concatenation of its atoms' text.

## 3. Inspect History

History is newest-first and cursor-bounded:

```bash
curl -sk -b cookies.txt \
  'https://127.0.0.1:8080/documents/<DOC_ID>/history?limit=20'
```

Expected: **200 OK** with `entries` and `nextCursor`. Each entry contains its
revision and prior revision, trusted author snapshot, `undoOf`/`redoOf` lineage,
bounded operation kinds and affected object IDs, `detailAvailable`, and
viewer-specific `canUndo`/`canRedo`. It contains no operation payload text or
private inverse recipe. Send a non-null `nextCursor` back unchanged to continue
to older retained summaries.

Fetch full public operations for one revision while its detail remains retained:

```bash
curl -sk -b cookies.txt \
  https://127.0.0.1:8080/documents/<DOC_ID>/history/<CHANGE_SET_ID>
```

This detail response is the public ChangeSet and still omits `inverseOps` and
the submission fingerprint. A pruned detail returns **404**, even when its
bounded summary remains in History.

## 4. Style a range with a mark

```bash
# bold the first word (bytes 0..5 of atom a1), at rune boundaries
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"mark-1","expectedRevision":1,"operations":[{"op":"add_mark","blockId":"b1","mark":{"kind":"bold","start":{"atomId":"a1","offset":0},"end":{"atomId":"a1","offset":5}}}]}'
```

Supported mark kinds: `bold`, `italic`, `underline`, `strike`, `code`, `link`
(`link` carries `attrs.href`). A mark whose range doesn't fit the current atoms is
rejected with **409**.

## 5. More ops

```bash
# insert a heading row at the top
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"row-1","expectedRevision":2,"operations":[{"op":"insert_row","afterRow":"","row":{"id":"r0","blocks":[{"id":"b0","kind":"text","subKind":"heading_1","atoms":[{"id":"a0","kind":"text","text":"Title"}]}]}}]}'

# insert then delete an atom
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"atom-insert-1","expectedRevision":3,"operations":[{"op":"insert_atom","blockId":"b1","afterAtom":"a1","atom":{"id":"a2","kind":"text","text":" and more"}}]}'
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"atom-delete-1","expectedRevision":4,"operations":[{"op":"delete_atom","blockId":"b1","atomId":"a2"}]}'
```

Each `GET /documents/<DOC_ID>` reflects the accumulated result.

### Fine-grained text, movement, and split/join

For normal typing, hash the Atom's exact current UTF-8 bytes and replace only
the half-open byte range `[startOffset,endOffset)`. Both offsets must be rune
boundaries:

```bash
TEXT_HASH="$(printf %s 'hello, world' | sha256sum | awk '{print $1}')"
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d "{\"submissionId\":\"splice-1\",\"expectedRevision\":<REVISION>,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"b1\",\"atomId\":\"a1\",\"startOffset\":5,\"endOffset\":5,\"insertText\":\" safely\",\"expectedTextHash\":\"$TEXT_HASH\"}]}"
```

The digest must be lowercase SHA-256. A changed Atom, stale digest, invalid
range, or mid-rune offset returns **409**. Marks on that Atom shift with the
splice; undo restores the exact prior text and Mark values. `set_atom_text`
remains available for compatible whole-value replacement.

Moves preserve the existing object's identity and require its exact current
parent/predecessor plus the destination anchor (`""` means the start):

```json
{"op":"move_row","rowId":"r1","fromAfterRow":"r0","afterRow":""}
{"op":"move_block","blockId":"b1","fromRowId":"r1","fromAfterBlock":"","rowId":"r2","afterBlock":"b2"}
{"op":"move_atom","atomId":"a1","fromBlockId":"b1","fromAfterAtom":"","blockId":"b2","afterAtom":"a2"}
```

A stale parent or predecessor returns **409**. Atom movement also conflicts if
it would leave a Mark pointing outside its Block.

`update_mark` sends the complete replacement with the same ID and
`expectedMarkHash`, the lowercase SHA-256 of the current Mark's canonical JSON
(`id`, `kind`, optional `attrs`, `start`, `end`; attribute keys sort
lexicographically). Copy the current Mark from `GET /documents/<DOC_ID>`, encode
that exact shape canonically, and hash its bytes before submitting the update.

The first split/join form is deliberately limited to adjacent Rows that each
contain one authored, unmarked text Block with one Atom:

```bash
HELLO_HASH="$(printf %s 'hello' | sha256sum | awk '{print $1}')"
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d "{\"submissionId\":\"split-1\",\"expectedRevision\":<REVISION>,\"operations\":[{\"op\":\"split_block\",\"blockId\":\"b1\",\"atomId\":\"a1\",\"startOffset\":2,\"expectedTextHash\":\"$HELLO_HASH\",\"row\":{\"id\":\"r2\",\"blocks\":[{\"id\":\"b2\",\"kind\":\"text\",\"atoms\":[{\"id\":\"a2\",\"kind\":\"text\",\"text\":\"\"}]}]}}]}"
```

The prefix keeps `r1`/`b1`/`a1`; the suffix fills `r2`/`b2`/`a2`. Join names
those left and right Blocks and supplies the exact current digest of each. It
concatenates into the left Atom and removes the right Row; undo recreates all
right-side IDs and style exactly.

### Proven semantic rebase

Two stale UTF-8 splices on the same Atom can both be accepted when their
half-open ranges are disjoint. Suppose both were authored against `"abcdef"` at
revision 0. After `[0,1) → "AA"` is accepted at revision 1, a stale
`[4,5) → ""` splice is transformed to the current coordinates and accepted at
revision 2:

```bash
ORIGINAL_HASH="$(printf %s 'abcdef' | sha256sum | awk '{print $1}')"
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d "{\"submissionId\":\"first\",\"expectedRevision\":0,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"b1\",\"atomId\":\"a1\",\"startOffset\":0,\"endOffset\":1,\"insertText\":\"AA\",\"expectedTextHash\":\"$ORIGINAL_HASH\"}]}"
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d "{\"submissionId\":\"disjoint\",\"expectedRevision\":0,\"operations\":[{\"op\":\"splice_atom_text\",\"blockId\":\"b1\",\"atomId\":\"a1\",\"startOffset\":4,\"endOffset\":5,\"insertText\":\"\",\"expectedTextHash\":\"$ORIGINAL_HASH\"}]}"
```

The second response has `authoredRevision: 0`, `priorRevision: 1`, and `seq: 2`;
the resolved text is `"AAbcdf"`. `authoredRevision` preserves the head the
client saw, while `priorRevision` is the actual head against which the accepted
inverse was computed.

Proof fails closed. Overlapping text ranges, insertion at an ambiguous
boundary, destructive hierarchy overlap, writes to the same style property, or
operations competing for the same ordering container return
`409 document_revision_conflict`. Independent style properties can commute
(for example, horizontal and vertical alignment). If checkpoint pruning has
removed the authored base or an intervening detailed ChangeSet, the backend
also returns the revision conflict rather than guessing.

## 6. Change row, block, and page layout

Inline styling remains in marks over atom ranges. Alignment belongs to a block,
extra height belongs to a row, and page geometry belongs to the document:

```bash
# add 18 points above the row baseline and align its block
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"style-1","expectedRevision":5,"operations":[{"op":"set_row_height","rowId":"r1","heightIncrease":18},{"op":"set_block_alignment","blockId":"b1","horizontalAlign":"center","verticalAlign":"bottom"}]}'

# change the document-wide page geometry
curl -sk -b cookies.txt -X POST https://127.0.0.1:8080/documents/<DOC_ID>/changes \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"layout-1","expectedRevision":6,"operations":[{"op":"set_page_layout","pageLayout":{"width":500,"height":700,"marginTop":50,"marginRight":40,"marginBottom":50,"marginLeft":40}}]}'
```

All dimensions are integer typographic points (1/72 inch). Each document
captures the configured maximum font height, minimum padding above and below a
row, and maximum height increase when it is created. Its baseline row height is
`maxFontHeight + 2 × minRowPadding`; `heightIncrease` adds to that baseline and
must remain between zero and the captured cap.

Pages are a deterministic projection rather than mutable content. Rows are
accumulated in order until the next complete row would exceed the page height
inside the top and bottom margins. A configuration change therefore does not
silently repaginate an existing document: the effective metrics travel with its
base.

## 7. Undo the current revision

Copy the `id` from the most recent change-set response:

```bash
curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/documents/<DOC_ID>/changes/<CHANGE_SET_ID>/undo
```

Expected: **201 Created** with a new change set whose `undoOf` is
`<CHANGE_SET_ID>`, whose `authorId` is still you, and whose `seq` is the next
document revision. A subsequent GET shows the exact pre-change content. The
inverse is stored by the server and is not exposed in the response.

Only the original author may undo a revision (**403** otherwise), and this
increment permits only the current head (**409** for an older revision). This
prevents an undo from overwriting work appended by another collaborator. An
undo revision cannot itself be sent to `/undo`; use explicit redo.

## 8. Redo the current undo revision

Copy the new undo change set's `id`:

```bash
curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/documents/<DOC_ID>/changes/<UNDO_CHANGE_SET_ID>/redo
```

Expected: **201 Created** with another ordinary compensating ChangeSet whose
`redoOf` points to `<UNDO_CHANGE_SET_ID>`. Its operations are the server-stored
inverse of the undo, so replay remains linear.

Redo requires the target to be a retained undo revision, the current Document
head, and authored by the caller. A new ordinary edit or another collaborator's
revision advances the head and invalidates the former redo opportunity.

---

**On the model:** every authored change set has a durable `id`, trusted author,
submission identity, `authoredRevision`, `priorRevision`, and server-assigned
`seq`. The document's public `revision` is the latest accepted sequence.
`authoredRevision` is the head the client observed; `priorRevision` is the
actual admission head, so they differ only after a proven semantic rebase. The
store accepts `seq N+1` only while the document is still at revision `N`; a CAS
race makes the service recompute the proof against the newer head. Unproven
overlap gets a bounded conflict, while an identical retry returns the already
stored revision. Reads replay pending sets over the base. Once enough
accumulate, the backend **re-bases** (folds them into a new base) so reads stay
fast, without changing the public revision. Undo appends stored compensation
rather than deleting history; undo and redo have their own Activity facts and
explicit `undoOf`/`redoOf` lineage. A configured positive History limit keeps
bounded summaries plus detailed pending reconstruction state and the current
compensation recipe; zero keeps all.
