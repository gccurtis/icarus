# Document inspector wiring (alignment, quote, columns), presence fix, and integration audit

Wires several previously-mocked document-inspector controls to real Omega changeset ops,
fixes a live op-vocabulary break and the half-wired presence, and reorganizes the
Alpha↔Omega integration docs into a verified `current/` set. All op shapes were verified by
round-trip against a fresh build of Omega `main` (current source), since the locally-running
Omega was a stale build predating these ops.

## Fix the `set_row_height` op break (P0)

The runtime emitted a `set_row_height` op that **no longer exists** in Omega's changeset
vocabulary — Omega replaced it with `set_block_line_height` (per-block). Any row-height edit
was therefore rejected by the backend, sending the document to save-`error`.

```ts
// runtime.ts — emit per-block line-height instead of the dead set_row_height
for (const block of row.blocks) {
  this.pendingOps.push({ op: 'set_block_line_height', blockId: block.id, lineHeight: heightIncrease });
}
```

Renamed the op in the type union (`heightIncrease` field → `lineHeight`), updated the
`operationLabel` map and its test, and relabeled the Details control "Line spacing".

## Make document presence actually join and publish (P1)

`collaboration.ts` only *read* `GET /sessions`; nothing ever registered a session, so the
open-user list was perpetually just "You". Added `joinSession` (`POST /sessions`),
`leaveSession` (`DELETE /sessions/current`), and a debounced `publishPresence`
(`PUT /sessions/current` with the current document). `DocumentStage` joins on mount / when the
tab becomes visible, publishes the active document, and leaves on teardown/hide. Collaborator
access level is now derived from real project-member roles instead of a hardcoded `'Viewer'`.

## Block alignment → `set_block_alignment` (Goal 1.1)

Alignment was local `$state` behind a mock badge. Added a `setBlockAlignment` action that
emits Omega's `set_block_alignment` op (its `horizontalAlign`/`verticalAlign` enums are
identical to Alpha's, so no translation). The Details toggles now reflect the block's real
style via `editorSession.blockAligns`, and alignment renders **live** through a `text-align`
node decoration in the pagination plugin.

## Quote = wrap the selection in quotation marks (Goal 1.3)

Per product intent, "Quote" wraps the selected text in quotation marks — a plain text edit —
rather than converting the block to a quote kind. The new `quoteSelection` action inserts the
quote characters, so the change flows to Omega through the ordinary text-diff ops with no new
op type.

```ts
// runtime.ts — insert the closing quote first so the opening insert doesn't shift it
tr = tr.insertText('"', to).insertText('"', from);
```

## Columns — multiple blocks in a row (Goal 1.2)

A column is just multiple blocks sharing a row, which Omega already models (`Row.tracks` ships
in the document; `insert_block` and `set_row_tracks` ops exist) — Alpha simply wasn't
exposing, rendering, or creating them. Added:

- `Track` type + `Row.tracks` (mirrors Omega), and `set_row_tracks` in the op union. Tracks
  already survived parsing via `normalizeDocument`'s row spread; now they're typed.
- **Side-by-side rendering** for any row with 2+ blocks — the pagination plugin lays each
  block out `inline-block` at its width percentage (from track weights; equal when a row has
  no tracks), reusing the same node-decoration mechanism as alignment.
- An `addColumn(afterBlockId, side)` action that splices a new block into the snapshot row,
  queues `insert_block`, and inserts a PM node carrying the **same** block id so the differ
  treats it as already in that row (a fresh node would be force-assigned its own row by
  `rowFor`). Wired the Details "Add column left/right" buttons; removed the mock.

Enter inside a column makes a new single-block row below — already ProseMirror's default — so
no custom keyboard handling was needed. Equal-width columns need no tracks; unequal widths /
drag-resize (`resize_adjacent_tracks`) remain a follow-up for the inspector width slider.

## Integration docs: `current/` vs `old/`, verified against Omega `main`

Reorganized `docs/integration/` — the prior audit/contract/plan trio moved to `old/`, and a
freshly verified set now lives in `current/`:

- `current/omega-integration.md` — the document-editor completion audit (every feature
  classified WIRED / mockable-now / blocked, with the exact Omega endpoint or op).
- `current/alpha-implementation-plan.md` — the Goal-by-Goal transition plan (Phase 0 fixes +
  the un-mock goals; 1.1/1.3/1.2 now marked done).
- `current/backend-contract.md` — only the genuinely-blocked features and what Omega must
  build (comments, references graph, windowed row reads, AI chat/attachments, etc.), with the
  reference-graph and windowed-row-read explanations expanded.

The audit corrected an earlier mislabeling of columns as "blocked" (Omega had the model all
along) and documents that the running dev Omega is a stale build that must be restarted onto
current `main` for these ops to round-trip in the app.
