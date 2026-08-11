# Discrepancy — documents: real content, translated shapes, id-keyed binding

The document editor is the first surface backed by **real Omega content**: documents
load from `/documents`, and every edit is appended as a change set
(`POST /documents/:id/changes`). The discrepancies here are the deliberate translations
and v1 seams at that boundary — not mocks. (How the editor works end to end lives in
[architecture/document-editor.md](../architecture/document-editor.md).)

## Shape translations (handled in `src/lib/features/stages/document/editor/`)

- **Rows are flattened.** Omega models a document as rows → blocks (rows are a future
  horizontal-layout seam). The editor renders blocks as one vertical list and remembers
  each block's `rowId`. Enter- or paste-created top-level blocks receive fresh rows;
  multiple blocks share a row only for deliberate columns. Multi-column layout is not
  represented spatially on the page yet.
- **Mark anchors are byte offsets.** Omega anchors marks at UTF-8 **byte** offsets
  inside an atom; ProseMirror positions are UTF-16 character offsets. `bridge.ts`
  converts byte→char when rendering and char→byte when writing (`charToAnchor`) —
  verified live with multibyte text.
- **Single-atom write model, marks rewritten whole.** Omega blocks hold ordered atoms;
  the editor writes a block's text as **one** atom (a multi-atom block consolidates on
  edit). A changed block's marks are fully removed and re-added from the ProseMirror
  node's truth — which carries mark positions through edits, so **plain typing no
  longer sheds styling**. The removals must precede the atom ops (the server sanitizes
  marks on text changes; removing an already-sanitized mark 409s the set).
- **Prompt blocks render as plain paragraphs** in the page (marked by a right-gutter AI
  indicator). Prompt instructions, resolve status, and evidence are intentionally not
  shown in Details; that workflow is reserved for the future AI Tasks view. Omega's
  stable resolve route remains available in the runtime (see
  [backend-requests/prompt-resolve.md](../archive/backend-requests/prompt-resolve.md)).
- **No reorder detection.** Entering the left gutter reveals one inspection handle
  per row; a handle inspects its row or single block, and Shift-click accumulates
  blocks. There is no drag-reorder yet, so the differ does not detect moves (a move
  would read as delete + insert). Reordering can build on these handles later.

## v1 seams

- **Document-bar collaboration is mixed real/mock.** Double-click rename is real
  (`PATCH /resources/document/:id`), and the relative “Edited … ago” label comes from
  Omega's Resource/document `updatedAt` (the full date/time remains available on
  hover). Attribution and presence are **real**: `systems/documents/collaboration.ts`
  derives the last editor from the document's history and the open-user list from a
  polled `GET /sessions`, with identities resolved through the identity directory.
  The remaining gap is push-based presence with a server-side TTL, tracked in
  [backend-requests/live-collaboration-presence.md](../backend-requests/live-collaboration-presence.md).
- **Document context is real.** Info title/identity, Outline, and word/character
  counts are real; Search/Replace derives from the live editor. References, Name
  Manager, Comments, AI Tasks, and History are real Omega clients. Raw rows,
  ambiguous lines, internal ids, and low-value block totals are deliberately not
  exposed. There is no page count and no derived sheets — pagination was removed, and
  a document renders as one continuous flow (`systems/documents/layout.ts`).
- **Document inspection is real.** Selected Text, Next Text, Block, and New Block are
  Alpha-facing translations over editor state, dispatched to per-selection **lenses**
  by a thin `DetailsPanel`. Block kind, the character marks
  (bold/italic/underline/strike/code/link), font family/size, foreground and
  background colour, indent, lists, alignment, and line height are all real
  operations. The clearly badged mocks that remain are narrow: non-link reference
  types and inspection-scoped comments.
- **Id-keyed binding.** With the resource catalog real (see
  [resources.md](resources.md)), a `document` resource's id **is** its Omega document id,
  so a document tab carries that id and the runtime loads by id — no name matching, no
  lazy-create. The old name-keyed path survives only as a fallback for **legacy tabs**
  persisted before ids existed (match by name, create if missing); once such tabs age
  out it is dead code.
- **Session cell required.** All document APIs 409 without a selected project; the
  workspace route now calls `POST /session/project` on entry (idempotent), and the
  stage retries once through it.
- **Revision-bound saves, reload conflicts.** Alpha sends an idempotent submission id,
  exact expected revision, and operations; it advances from the accepted sequence.
  On a 409 (someone else changed the document), the editor reloads server truth and
  re-places the cursor. Real semantic rebase remains future work.
- **Reads are whole-document, by choice.** Alpha loads and diffs the entire document.
  Row windowing was withdrawn along with pagination: the windowing seam, the
  paginator, and the manifest/body repository were all deleted rather than kept
  waiting for a backend contract nobody wanted. The accepted ceiling is recorded as
  P-2 in the reorg catalog
  ([archive/plans/2026-07-27-document-subsystem-issues.md](../archive/plans/2026-07-27-document-subsystem-issues.md)).
