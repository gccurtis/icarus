# General block indent (backend-outstanding Phase D)

Any block can carry an indent level, independent of list nesting — the same way
it carries alignment and line height.

## Model

`BlockStyle` gains **`Indent int`** (0 = flush left), bounded by **`MaxBlockIndent`
= 16** and checked in `validBlockStyle` via `validBlockIndent`. It is a general
block indent, separate from a list item's `Level`.

## Op

**`set_block_indent` `{blockId, indent}`** mirrors `set_block_line_height` through
the full changeset lifecycle: validate (present and in `[0, 16]`), apply (set
`Style.Indent`), inverse (restore the prior indent), rebase footprint
**`block-indent:<blockId>`** (its own key, like line-height and alignment — indent
edits to different blocks are independent, and a concurrent indent edit to the
same block conflicts), and clone (copy the `Indent` pointer). History summarizes
it by its block id.

## Tests

- Unit (`core/capability/document`): set an indent and read it back, undo restores
  the prior value, and an indent past `MaxBlockIndent` is rejected.
- Dev-test: `dev-test/typography` extended — set a block indent to 4 and confirm
  it, then reject an indent past the maximum.

## Settled

- Indent is a bounded `BlockStyle` field (≤ 16), independent of list level. ✓
- `set_block_indent` is a full-lifecycle block-style op with its own rebase
  footprint, mirroring line-height. ✓
