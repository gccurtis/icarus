# Native list block kind (backend-outstanding Phase C)

A list is one `list` block that holds its items internally, rather than a run of
sibling `list_item` blocks. Insert a list, add items, set the marker style — all
edits target the single block.

## Model (`core/capability/document`)

- **`BlockKindList`** joins the block catalog. Its payload is **`ListBlockData{
  Type, Start, Items }`** — a marker `Type` (`bullet` / `ordered` / `check`), an
  ordered-list `Start` ordinal, and the ordered `Items`.
- **`ListItem{ Level, Checked, Atoms, Marks }`** carries one entry's nesting
  level, its checked state (meaningful only for a check list), and inline content
  exactly like a text block — so bold/italic/links render inside an item.
- **Bounds:** ≤ **256 items** per list, item level ≤ **8**. Each item's atoms and
  marks are validated the way a text block's are (atom kinds, mark kinds, and
  mark ranges over the item's own atoms), via `validateListItem`.

## Ops (full lifecycle each)

- **`set_block_data` `{blockId, listData}`** — replace a list block's whole typed
  payload (validated). Rejected on a non-list block.
- **`set_list_type` `{blockId, setListType, listStart?}`** — change the marker
  type and, optionally, the ordered start.
- **`set_list_item` `{blockId, listIndex, item?}`** — insert/replace/remove one
  item. A nil `item` removes; `listIndex == len` appends; re-level and check are
  just a replaced item's fields.

All three **invert** to a single `set_block_data` restoring the block's prior
`ListBlockData` — always-correct compensation without per-edit bookkeeping. Their
**rebase footprint** is a shared **`block-data:<blockId>`** write, so concurrent
edits to the same list conflict while edits to different lists stay independent.
Clone deep-copies the new op fields (`ListData`, `SetListType`, `ListStart`,
`Item`); history summarizes them by their block id like any block op.

## Markdown

Render each item on its own line, indented two spaces per level, under a marker
chosen by the type: `- `, `1. ` counting from `Start`, or `- [ ] ` / `- [x] `.
Inline styling reuses `RenderBlockMarkdown` over the item's atoms and marks. On
import, a blank-line-delimited chunk whose every line is a list item becomes one
`list` block (`parseListChunk`), with the type and ordered start taken from the
first item; `*`/`+`/`-` bullets, `N.`/`N)` ordinals, and `[ ]`/`[x]` checkboxes
are all recognized. Bullet, ordered, and check lists round-trip.

## Tests

- Unit (`core/capability/document`): create + persist a list; `set_block_data` and
  `set_list_type` (marker + start); `set_list_item` insert/replace/remove/re-level;
  undo restores the prior payload; bounds (over-deep level, > 256 items) rejected;
  list ops rejected on a non-list block; a bullet/ordered/check Markdown round-trip.
- Dev-test (`dev-test/list-block`, free): create a list, append a nested item,
  remove an item, change the type to ordered-from-3, replace the payload with a
  check list, reject a list op on a text block, and round-trip three list styles
  through Markdown.

## Settled

- One `list` block, items held internally (not sibling blocks). ✓
- `set_block_data` / `set_list_type` / `set_list_item`, each a full lifecycle;
  list-data ops share the `block-data:<id>` rebase footprint. ✓
- Bounds in code (≤ 256 items, level ≤ 8); item inline content validated like a
  text block. ✓
- Markdown round-trips bullet / ordered / check; the agent tool keeps its
  text/code vocabulary (lists are authored through the document API).
