# Several elements

| Selecting | What it is | Sections |
| --- | --- | --- |
| Two or more elements, shift-clicked | The selection as a group: what they have in common, and the operations that need more than one | Selection · Align · Distribute · Arrange · Shared geometry · Shared format |

A multi-selection is a different thing from an element, not a degraded one. Align
and distribute exist only here, and appear only when they can do something.

## Layout

| 300px |
| --- |
| selection |
| align |
| align |
| distribute |
| arrange |
| shared geometry |
| shared format |

## Selection

What is in the selection, named, so it is clear what everything below applies to.

**Shows** — `Title` · `Body text` · `Chart`, with one line saying everything below
applies to all three.

**Needs** — the selected element IDs resolved to names.

## Align

**Shows** — Left · Centre · Right · Top · Middle · Bottom

**Needs** — geometry mutation across the selection.

**Open** — align relative to what: the selection's bounds, the first-selected
element, or the slide. Three defensible answers, and the panel currently states
none.

## Distribute

**Shows** — Horizontally · Vertically

Requires three or more, so it is inert with two.

**Needs** — as above.

## Arrange

**Shows** — Group · Front · Back

**Open** — grouping is offered but there is no group object in the model. Either a
group exists as a thing, or this button is a multi-select convenience that does
not persist, and the difference matters after a reload.

## Shared geometry

Where the selection agrees and where it does not. *Mixed* is a value, and setting
over it applies to all.

**Shows** — `Width · Mixed`, `Height · Mixed`, `Rotation · 0°`

**Needs** — per-property comparison across the selection.

## Shared format

The same idea for fill, border and padding, stated in prose rather than as fields
because they differ across the selection.

**Needs** — as above.

**Open** — the section says values differ but does not offer to set them. It
should behave like Shared geometry: show *Mixed* and let it be overwritten.
