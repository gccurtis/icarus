## The claim

The document is the runtime's live body — a `DocumentBody` of rows of blocks, held in `runtime.body` on the document runtime — and ProseMirror is a projection of it and an input device for it. Nothing the editor draws is the truth, and nothing the editor does reaches the body except as a list of `DocumentOp`s. Typing is the one exception to "ops first": a keystroke lands in ProseMirror's state, and the op is derived from the difference afterwards. Everything structural — split, merge, move — is an op from the start.

The whole loop is in [[file:app/src/lib/app-views/categories/document-editor/content/document.svelte]]; the nine procedures beside it are pure functions the view calls.

## The loop

1. `view.documentRuntime(id)` attaches the runtime ([[check:runtime-through-workspace-state]]); its `body` arrives from `readDocumentBody` on the first `sync`.
2. `paint(body)` builds an `EditorState` from `docOf(body, metrics)` ([[file:app/src/lib/app-views/categories/document-editor/procedures/projection.ts]]) and remembers `sent = bodyOf(doc, body)` — the body as the editor understood it.
3. Every transaction goes through `dispatch`: apply it, `lay` the result (stamp ids on anything unnamed, repaginate, restore the selection by anchor), update the view, `signal` the inspector, and — if the document changed and the change was not layout — `emit`.
4. `emit` computes `body = bodyOf(state.doc, sent)`, `ops = translate(sent, body)` ([[file:app/src/lib/app-views/categories/document-editor/procedures/translate.ts]]), sets `sent = body`, and calls `runtime.apply(ops)`.
5. The runtime buffers the ops, pushes them on its undo stack, and schedules a flush ([[page:/algorithms/revisions|Revisions]]). When a new body comes back from the server, the effect compares it to `sent`; if `translate(sent, body)` is empty the editor is already showing it and nothing is repainted.

The diagram follows one keystroke around that loop.

## The projected schema

[[file:app/src/lib/app-views/categories/document-editor/procedures/schema.ts]]: `doc → page+ → blocks_row+ → text_block+ → inline*`, and no marks. A `blocks_row` carries `rowId` and `proportions`; a `text_block` carries `blockId`, `atomId` and `share`. There is no node for an image, a divider, a page break, a table or a formula — a row or block the editor cannot draw is carried through `bodyOf` untouched and put back where it was (`heldAmong` / `putBack`, anchored to the nearest drawn thing before it). What the editor can draw is exactly a text block whose whole content is one literal atom (`soleLiteral`).

## Translation

`translate(was, now)` is a diff over ids, never positions. For each surviving row it emits a `set` for changed proportions and, per block, a `text` op computed by trimming the common prefix and suffix of the old and new atom text; an unknown block id is an `insert`, a vanished one a `remove`, each carrying `after` (the previous id) and the value, so it inverts. Rows the same way, plus a `move` when a surviving row's anchor changed. The order is edits, removals, insertions, moves. Every op carries enough to be undone by [[file:app/src/lib/model/client/document-runtimes/methods/history/invert.ts]] — `insert`↔`remove`, `set` swaps `value`/`was`, `move` swaps `after`/`wasAfter`, `text` swaps `insert`/`remove`.

## Pagination

[[file:app/src/lib/app-views/categories/document-editor/procedures/paginate.ts]] measures rows in lines: a text block's lines are its display text word-wrapped into a budget of characters (`budgetOf(share, charactersPerLine)`), an image is 12, a table sums its rows, a divider is 1, a page break is 0 and closes the page. `pack` fills pages greedily. The metrics come from [[file:app/src/lib/app-views/categories/document-editor/procedures/page-setup.ts]]: a 52 rem page, 1 rem body text at 1.625 line height, an average glyph 0.52 em wide, and the paper and margins from the body's `pageSetup` (Letter with 0.75 in margins by default). Zoom is 50–200 and fits to the pasteboard width.

## Split, merge, inspect, highlight

[[file:app/src/lib/app-views/categories/document-editor/procedures/editing.ts]] binds Enter to `splitRow` and Backspace to `mergeRow` as ProseMirror commands: a split moves the tail into a new `blocks_row` with freshly minted ids and translates to one `text` op and one row `insert`; a merge joins onto the row above and translates to one `text` op and one row `remove`. [[file:app/src/lib/app-views/categories/document-editor/procedures/inspecting.ts]] turns the selection into a `Signal` — `document-editor.text-selection` for a range, `document-editor.empty-block` or `document-editor.next-letter` for a caret — addressed as `<block>/atoms/<atom>@<offset>`, and `worthSending` stops the view from re-inspecting what is already inspected. [[file:app/src/lib/app-views/categories/document-editor/procedures/highlight.ts]] is the plugin that keeps a text selection lit while the inspector holds it.
