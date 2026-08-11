# Change record — 2026-07-21 — Increment 2: selection styling (marks sync)

Marks stop being display-only: styling a selection is now a real, synced edit.
Executes [plans/2026-07-21-next-steps.md](../plans/2026-07-21-next-steps.md) § 2.

## The bridge — mark reconciliation

[`document/editor/bridge.ts`](../../../src/lib/features/stages/document/editor/bridge.ts):

- **`charToByte` / `charToAnchor`** — the write-side inverse of the existing byte→char
  rendering: a block-global character position becomes an `{atomId, byte offset}`
  anchor (boundary rule: starts open in the later atom, ends close in the earlier).
- **`nodeMarks`** reads the mark ranges a ProseMirror node *wants* (merging adjacent
  same-mark runs); **`blockCharMarks`** reads what the snapshot *has*; **`sameMarks`**
  compares canonically; **`toDocMarks`** materializes desired ranges as Omega marks
  with fresh client ids.
- **The differ rewrites marks whole**: when a block's text changed (positions shift —
  the PM node carries mark positions through edits, so this is also what makes plain
  typing **preserve** styling instead of shedding it) or its desired set differs, all
  existing marks are removed and the desired set re-added. **Removals precede the atom
  ops** — the server sanitizes marks on text changes, and removing an
  already-sanitized mark 409s the whole set. New blocks carry their marks in the
  `insert_block` payload.

## The surface

- **Actions** (`EditorActions`): `toggleMark(kind)` (ProseMirror `toggleMark` command)
  and `setLink(href | null)`; keymaps **Mod-B / Mod-I / Mod-U** in the editor.
- **Session**: the `range` selection now carries `marks` (which kinds are present —
  via `rangeHasMark`) and `linkHref`.
- **Range lens** ([`DetailsPanel`](../../../src/lib/features/stages/document/panels/DetailsPanel.svelte)):
  five style toggles (bold/italic/underline/strike/code, pressed-state from the
  session) and the link row (set an href over the selection / Unlink), above the
  counts.

## Verified live (throwaway Omega, repo untouched)

- `add_mark` with **multibyte byte anchors** (bold over "héllo" at bytes 0..6) → 201.
- The reconciliation ordering as one change set (`remove_mark` → `set_atom_text` →
  `add_mark` with shifted range) → 201, read-back exactly the predicted
  `{"kind":"bold","s":2,"e":8}`.
- The **wrong** ordering (`set_atom_text` shrink, then `remove_mark` on the sanitized
  mark) → **409** — proving the remove-first rule is necessary.
- `link` mark with `href` and a multibyte end anchor → 201. Test document deleted.

Plus `pnpm check` 0/0 and a clean build. Architecture (mark row, invariant 7, extension
map) and the documents discrepancy updated; plan § 2 marked done.
