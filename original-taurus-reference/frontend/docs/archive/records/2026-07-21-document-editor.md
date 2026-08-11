# Change record — 2026-07-21 — The document editor (ProseMirror ↔ Omega change sets)

The first **real content surface**: opening a document-kind resource now renders a
ProseMirror editor whose content loads from Omega and whose every edit is appended back
as a change set. No mocks in the editing path.

## What was built

- **`src/lib/data/documents.ts`** — the documents API layer, typed 1:1 against Omega's
  JSON (`core/capability/document`): `Doc`/`Row`/`Block`/`Atom`/`DocMark`, the
  `ChangeOp`/`ChangeSet` shapes, and `list/get/create/delete/appendChanges`.
  `newUnitId()` generates client-side unit ids — Omega accepts caller-supplied ids on
  inserts, which is what lets the editor's local snapshot stay authoritative without a
  refetch after every save.
- **`src/lib/editor/schema.ts`** — the ProseMirror schema projecting Omega's model:
  `paragraph` (also carries `prompt` via a `kind` attr, never rewritten) + `heading`
  (level attr ↔ `heading_1..6`), every node carrying `blockId`/`rowId` attrs; marks
  bold/italic/underline/strike/code/link (display-only for now).
- **`src/lib/editor/bridge.ts`** — the translation core. `omegaToPmDoc` flattens rows
  into block nodes, concatenates atoms, and maps mark anchors (UTF-8 **byte** offsets)
  into character ranges. `diffDoc` turns an edited ProseMirror doc back into
  id-addressed ops: blocks matched by `blockId` attr; null/duplicated ids (Enter
  splits) → `insert_block` with client ids; gone → `delete_block`; text →
  `set_atom_text` (single-atom write model, consolidating multi-atom blocks);
  heading↔paragraph → `set_block`. Deletes are ordered first, inserts anchor in
  document order. It also returns the predicted next snapshot + the attr fix-ups for
  new nodes.
- **`src/lib/features/stages/DocumentStage.svelte`** — the stage: a **stable centered
  column** (`max-w-3xl`, generous margin — panels will collapse into the margin without
  reflowing the text), a quiet Document eyebrow + live save status, and the calm
  writing surface (nondescript blocks, base keymap: Enter splits, Backspace on empty
  joins up, undo/redo). Sync loop: edits debounce 700ms → diff → `appendChanges`; on
  success the predicted snapshot is adopted; on **409 conflict** it reloads server
  truth and re-places the cursor by block id; on network failure it shows
  "Couldn't save — retrying" and retries; page-hide and unmount force a final flush.
- **Wiring** — `WorkSurface` routes `kind === 'document'` resource tabs to the stage
  (and now enters the project's resources itself so a direct reload can resolve tab
  kinds); the workspace route calls `POST /session/project` on entry, because all
  document APIs 409 without a selected project.

## Verified live (throwaway Omega instance)

Ran a scratch Omega (`TAURUS_OMEGA_CONFIG` → scratch db/port, taurus-omega repo
untouched, working tree confirmed clean) and replayed the client's exact requests:
register → project → select → `POST /documents` (creation payload) → the differ's op
patterns (`set_atom_text`; Enter-split `insert_block` with client ids + `set_block`
heading toggle; backspace-join `delete_block` + `set_atom_text`) → resolved read-back
matched the predicted snapshot exactly (`heading_1 "helloworld"`) → stale-id probe
answered **409**, the conflict path the stage handles. Plus `pnpm check` 0/0 and a
clean `pnpm build`.

## Decisions and deferred work

- **Deps:** added the six ProseMirror packages (model/state/view/keymap/commands/history).
- **Name-keyed binding (v1):** tabs carry only titles and the resource table is still
  the mock, so the stage binds tab→document by name (creating when missing). Closes
  when the resources backend request lands and tabs carry real ids.
- **Documented** in `docs/discrepancies/documents.md` (rows flattened, byte-offset
  marks, single-atom writes, no reorder detection, conflict-reload); backend-request
  `resources.md` updated (documents landed; unify the table over them); orientation doc
  updated (real-vs-mock, directory map, quick-ref).
- **Next increments:** block handles + prompt blocks (opposite-side AI handle), the
  inspector (fonts/marks/kind controls), panels adjusting within the margin.
