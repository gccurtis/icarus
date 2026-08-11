# Discrepancy — document inspector vocabulary and capability seam

Alpha describes editor inspection in the vocabulary users act on:

- **Selected Text** — a visible text range, including one that crosses block boundaries.
- **Next Text** — the caret plus persistent marks/reference for subsequent typing.
- **Block** — one existing content block.
- **Multiple Blocks** — an explicit set of blocks.
- **Row** — a horizontal group and its child blocks.
- **New Block** — an empty paragraph ready to be assigned a block kind.

This is intentionally more task-oriented than ProseMirror's cursor, stored marks,
text-selection, and node-selection types. `document/editor/session.ts` translates the editor state
into the Alpha vocabulary before the Details panel sees it. A normal gutter-anchor
click inspects the row when it has multiple children and otherwise inspects its
block; Shift-click builds a multi-block inspection. The page does not reveal anchors
on content hover: entering the left gutter reveals one handle for every row, and
leaving the gutter hides them.

## Real and mocked controls

Block kind and Selected Text formatting use the existing Omega document/change-set
model and are real. Next Text uses ProseMirror stored marks; once text is typed,
those marks enter the same real sync path. Whole Block and Multiple Blocks views are
layout-only. Line spacing is now durable through Omega's `set_block_line_height` operation and
feeds Alpha's canonical page plan immediately. Font family, size,
foreground/background colors, quote formatting, non-link reference types, block
alignment, normalized widths, column insertion, and inspection-scoped comments lack a
durable Omega shape. They remain interactive and carry adjacent **Mock** badges. The
font control is a typeable
combobox, while font size, line spacing, and normalized widths use the Taurus number
field with explicit −/+ controls instead of native browser spinners. The compact
field remains context-neutral: labels such as Size
and Height are supplied by its composing inspector view rather than built into the
component. The real row-height control still enforces an ascribed font-box floor per
block kind and uses the tallest child as the row minimum before translating pixels to
Omega's bounded whole-point height increase.

The Details panel deliberately does not host prompt instructions, resolve state,
evidence, or a general AI prompt. Those are AI-task workflows, not actions for
formatting or arranging the inspected content.

The missing persistence contracts are tracked in
[backend-requests/document-inspector.md](../archive/backend-requests/document-inspector.md).
