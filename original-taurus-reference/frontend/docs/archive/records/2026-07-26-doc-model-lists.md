# Doc-model Stage 4 — native list editing

Real, editable lists (record 0080). A list is one `list` block holding its items
internally; Stage 1 round-tripped it as a placeholder — now it's a first-class,
editable node.

## Model

- **Schema** — a flat `list` node (attrs `listType` `bullet|ordered|check`, `start`)
  containing `list_item` nodes (attrs `level` 0–8, `checked`). Items are siblings with
  a nesting *level*, mirroring Omega's `ListBlockData`/`ListItem` (not nested `<ul>`s).
- **Bridge** — `listNode` builds the node from `ListBlockData`; `listDataFromNode` /
  `itemFromNode` invert it (single-atom write model, marks kept). The diff emits
  **`set_block_data`** with the whole payload when a list changes (all list ops invert
  to that), deduped by a structural `listSignature` so an unchanged list re-diffs to no
  op. `inlineContentFrom` is now shared by text blocks and list items.

## Editing

- **Insert** — `insertElement('list')` drops in a one-item bullet list, caret inside.
- **Keymap** (`list-commands.ts`) — **Enter** splits the item into a new one (empty item
  → exit the list into a paragraph); **Tab / Shift-Tab** change the item's nesting level.
- **Marker type** — the inspector's **List** controls (Bulleted / Numbered / Checklist +
  ordered Start) drive `setListType`, which retypes the node → `set_block_data` on flush.
- **Check** — a click on a check item's marker toggles `checked` (`handleClickOn` in the
  stage); the CSS renders the checkbox + strike-through.
- **Rendering** — `.doc-list` CSS: bullet / ordered-counter / checkbox markers, per-level
  nesting indent, checked state. The ordered `start` seeds the CSS counter via `toDOM`.

## Verification

- `pnpm check` **0 errors**; `pnpm test` **254 passed** — the bridge test now covers the
  list node mapping (type/start/items/level) and the diff (unchanged → no op; item change
  → `set_block_data` with the full payload).
- Op field names contract-matched to Omega (`set_block_data {listData}`, `ListItem
  {level, checked, atoms, marks}`).
- Live browser E2E pending (no headless Chrome; stack up on `:5173`).
- Companions: 6 updated + 1 new (`list-commands.ts.md`), all byte-verified.

## Notes

- Marker-type changes and item edits both flush as `set_block_data` (simplest correct
  compensation); the finer `set_list_type`/`set_list_item` ops are available if we later
  want smaller changesets.
