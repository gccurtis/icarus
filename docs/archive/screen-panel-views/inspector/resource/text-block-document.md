# A text block

| Selecting | What it is | Sections |
| --- | --- | --- |
| A whole block — a paragraph, a heading, a list | The block itself: what kind it is, how it is spaced, where it sits | Text · Variant · Block format · Placement |

Selecting the block rather than text inside it. The distinction matters: marks
belong to a range, variant and spacing belong to the block.

## Layout

| 300px |
| --- |
| text |
| variant |
| block format |
| block format |
| placement |

## Text

The block's content, quoted, so you can tell which block you have.

**Shows** — "What the field data shows"

**Needs** — the block's text.

## Variant

What kind of block it is. Changing this is the one edit that changes the block's
meaning rather than its appearance.

**Shows** — Body · Heading 1 · Heading 2 · Quote · Code

**Needs** — the block variants the body model supports.

## Block format

Alignment and the space around it. Space before and after are block properties,
distinct from the line spacing that lives on the named style.

**Shows** — `Alignment · Left | Center | Right`, `Space before · 12 pt`, `Space after · 6 pt`

**Needs** — per-block alignment and spacing overrides.

**Open** — space after exists on both the named style and the block. Which wins,
and whether the block value should be an override marked as such, needs settling.

## Placement

Where the block sits — its position in a row, and the page it currently lands on.
Starts collapsed.

**Shows** — `Row · 1 block of 1`, `Page · 2 (computed)`

A computed page has no ID. It is a label for where this block currently falls,
and the panel marks it as computed so it is never mistaken for an address.

**Needs** — the block's position in its row, and the current pagination.
