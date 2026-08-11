# Backend request — document inspector formatting and layout

**Priority:** Medium · **Status:** Partially shipped
**Unblocks:** durable extended typography, normalized column widths/layout, and
comments anchored to inspected document content. Row height is already real in Alpha;
Omega block alignment is shipped and awaits frontend wiring.

## What Alpha can already do

The inspector can use Omega's existing document contract for block identity and
kind, cross-block text ranges, bold/italic/underline/strike/code/link marks, and
block insertion. Alpha exposes those capabilities without a **Mock** badge. Line spacing
also persists through `set_block_line_height`, observes Omega's captured layout bounds, and
repaginates the document immediately.

Omega additionally ships `set_block_alignment` with independently optional
`horizontalAlign` (`left|center|right`) and `verticalAlign`
(`top|middle|bottom`). Alpha already normalizes those fields at the data boundary, but
the inspector still presents alignment as a mock until the bridge and renderer write
and display it.

The current contract has no durable representation for these remaining controls:

- font family and font size;
- foreground and background color;
- inline quote formatting;
- normalized widths for blocks within a row;
- comment threads anchored to selected text or the next-text insertion point.

Alpha renders those controls as explicit mocks. Column insertion is also kept mocked:
`insert_block` already accepts a row and sibling anchor, but widths have no canonical
representation and the current editor deliberately flattens rows, so it cannot safely
preserve a user-visible column result yet.

## Shipped Omega operations

```json
{ "op": "set_block_line_height", "blockId": "block-id", "lineHeight": 1.5 }
{
  "op": "set_block_alignment",
  "blockId": "block-id",
  "horizontalAlign": "center",
  "verticalAlign": "middle"
}
```

Both operations are revisioned, validated, represented in history summaries, and
undoable through Omega's document history contract. `set_block_line_height` is integrated;
`set_block_alignment` is Alpha-only follow-up.

## Remaining capability boundary

Omega owns the final operations and schemas. The existing mark and change-set model
could be extended with equivalents of:

```json
{ "op": "add_mark", "kind": "font_family", "value": "IBM Plex Sans", "range": "…" }
{ "op": "add_mark", "kind": "font_size", "value": 16, "range": "…" }
{ "op": "add_mark", "kind": "foreground", "value": "#202428", "range": "…" }
{ "op": "add_mark", "kind": "background", "value": "#f4e8a8", "range": "…" }

{
  "op": "set_row_layout",
  "rowId": "row-id",
  "widths": [
    { "blockId": "first-block", "percent": 35 },
    { "blockId": "second-block", "percent": 65 }
  ]
}
```

Widths must be keyed by stable block id, be positive, and total exactly 100. Alpha
calculates the final width field in the inspector, but Omega should still validate
the submitted total and return canonical values. Anchored comments are covered by
[document-context](document-context.md); their anchor shape must support selected text
that crosses block boundaries and a caret insertion point.

## Front-end follow-up when it lands

Wire the already-shipped block alignment through the document bridge and renderer,
then remove its **Mock** badges. As the remaining contracts ship, extend the schema and
bridge for new mark/width fields, render row structure on the page, enable real
left/right column insertion, and remove **Mock** badges capability by capability. Add
round-trip tests for multibyte range anchors, mixed formatting, width validation, and
row edits under concurrent change sets.
